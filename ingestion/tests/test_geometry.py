"""TDD for parcel-centroid geometry (real lat/lng for the map, bulk source).

The OpenData parcel layers are non-spatial, but NDS_parcel_relate/0 (cvgis.CITY.parcel_area)
has the polygons keyed by GPIN. We pull them in one batch and compute centroids (pure,
shoelace) — no per-address calls. Geocoder stays a precise override (see test_geocode).
"""
import json
import pathlib

from ingestion import geometry

FIX = pathlib.Path(__file__).parent / "fixtures"
RESP = json.loads((FIX / "parcel_geometry_sample.json").read_text())


def test_polygon_centroid_matches_known_parcel():
    feat = next(f for f in RESP["features"] if f["attributes"]["GPIN"] == 3827)  # 1305 Grady
    lat, lng = geometry.polygon_centroid(feat["geometry"]["rings"][0])
    assert round(lat, 4) == 38.0402
    assert round(lng, 4) == -78.4955


def test_parse_parcel_features_keys_by_gpin_string():
    by = geometry.parse_parcel_features(RESP)
    assert "3827" in by                      # keyed by GPIN as string (matches property.gpin)
    assert len(by) == len(RESP["features"])
    lat, lng = by["3827"]
    assert round(lat, 4) == 38.0402


def test_attach_centroid_sets_lat_lng_and_provenance():
    by = {"3827": (38.040203, -78.495520)}
    prop = {"gpin": "3827", "provenance": {}}
    out = geometry.attach_centroid(prop, by)
    assert out["lat"] == 38.040203 and out["lng"] == -78.495520
    assert "centroid" in out["provenance"]["lat"]["source"]
    assert out["provenance"]["lat"]["confidence"] == "real"


def test_attach_centroid_unknown_gpin_is_noop():
    out = geometry.attach_centroid({"gpin": "999999", "provenance": {}}, {"3827": (1, 2)})
    assert out["lat"] is None and out["lng"] is None


def test_polygon_centroid_handles_unclosed_ring():
    # robust to a ring that doesn't repeat its first vertex (don't assume closure).
    # This quad's closing edge has non-zero cross, so an unclosed-loop bug would show.
    quad = [[1, 1], [4, 1], [4, 5], [1, 4]]             # no closing point
    lat, lng = geometry.polygon_centroid(quad)
    assert (round(lat, 4), round(lng, 4)) == (2.7619, 2.5714)   # true closed centroid


def test_parse_picks_largest_ring_for_multipart_parcel():
    # a multipart parcel: pin should land in the LARGER part, not whichever ArcGIS listed first
    small = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]                 # 1x1 at origin
    big = [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]        # 10x10 far away
    resp = {"features": [{"attributes": {"GPIN": 42}, "geometry": {"rings": [small, big]}}]}
    lat, lng = geometry.parse_parcel_features(resp)["42"]
    assert (round(lat), round(lng)) == (15, 15)        # center of the big ring
