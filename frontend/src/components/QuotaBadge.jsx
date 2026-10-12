export default function QuotaBadge({ quota }) {
    if (!quota) return null;
    const exhausted = quota.remaining === 0;
    return (
        <span className={`quota-badge${exhausted ? ' exhausted' : ''}`} role="status">
            {quota.remaining}/{quota.limit} requests left this minute
        </span>
    );
}
