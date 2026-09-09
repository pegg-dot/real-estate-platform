import Link from "next/link";
import Icon from "./Icon";
export default function AsyncState({ title, description, loading, error, retry, action }: {
  title: string; description?: string; loading?: boolean; error?: boolean; retry?: () => void; action?: { href: string; label: string };
}) {
  return <div className={`empty-state${error ? " error-state" : ""}`} role={error ? "alert" : "status"}>
    <span className="empty-icon"><Icon name={loading ? "refresh" : error ? "warning" : "layers"} size={22} className={loading ? "is-spinning" : ""} /></span>
    <h3>{title}</h3>{description && <p>{description}</p>}
    {retry && <button className="btn" onClick={retry}><Icon name="refresh" size={15} />Try again</button>}
    {action && <Link className="btn" href={action.href}>{action.label}<Icon name="right" size={15} /></Link>}
  </div>;
}
