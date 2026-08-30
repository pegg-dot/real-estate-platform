"""The county pull runs ~300 sequential requests before a single row is written, so one transient
`Connection refused` must not throw the whole run away. Pin the retry policy of the shared fetcher."""
from unittest import mock

import pytest

from ingestion import charlottesville as cv


class _Resp:
    def __init__(self, body: bytes):
        self._body = body
    def read(self):
        return self._body
    def __enter__(self):
        return self
    def __exit__(self, *a):
        return False


def _flaky(fail_times: int):
    calls = {"n": 0}
    def urlopen(req, timeout=None):
        calls["n"] += 1
        if calls["n"] <= fail_times:
            raise ConnectionRefusedError(111, "Connection refused")
        return _Resp(b'{"features": []}')
    return urlopen, calls


def test_survives_a_burst_of_refusals_then_succeeds():
    urlopen, calls = _flaky(fail_times=4)
    sleeps: list[float] = []
    with mock.patch.object(cv.urllib.request, "urlopen", urlopen), \
         mock.patch.object(cv.time, "sleep", sleeps.append):
        assert cv._get("https://example.invalid/x") == {"features": []}
    assert calls["n"] == 5
    assert len(sleeps) == 4 and sleeps == sorted(sleeps)   # backs off, never tighter
    assert sum(sleeps) >= 30                                # rides out a >30 s outage


def test_gives_up_loudly_after_the_budget():
    urlopen, calls = _flaky(fail_times=99)
    with mock.patch.object(cv.urllib.request, "urlopen", urlopen), \
         mock.patch.object(cv.time, "sleep", lambda s: None), \
         pytest.raises(RuntimeError, match="Connection refused"):
        cv._get("https://example.invalid/x")
    assert calls["n"] == cv.FETCH_RETRIES          # the policy is one named number, not folklore
    assert cv.FETCH_RETRIES >= 6
