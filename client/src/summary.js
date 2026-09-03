// Client-side counts for the admin inbox summary cards.
export const STATUS_NEW = "New";
export const STATUS_IN_REVIEW = "In review";
export const STATUS_CLOSED = "Closed";

export function summarizeFeedback(items) {
  const list = Array.isArray(items) ? items : [];
  const summary = { total: list.length, new: 0, inReview: 0, closed: 0 };
  for (const item of list) {
    const status = String(item?.status ?? "").trim().toLowerCase();
    if (status === STATUS_NEW.toLowerCase()) summary.new += 1;
    else if (status === STATUS_IN_REVIEW.toLowerCase()) summary.inReview += 1;
    else if (status === STATUS_CLOSED.toLowerCase()) summary.closed += 1;
  }
  return summary;
}

export function summaryCards(summary) {
  return [
    { key: "total", label: "Total", value: summary.total },
    { key: "new", label: "New", value: summary.new },
    { key: "inReview", label: "In review", value: summary.inReview },
    { key: "closed", label: "Closed", value: summary.closed },
  ];
}
