/**
 * Deduplicates bids by user_id, keeping only the highest bid per user
 * Then sorts by amount descending
 * This ensures each user appears only once in rankings
 */
export function deduplicateAndSortBids(bids: any[]): any[] {
  // Deduplicate by user_id - keep only the highest bid per user
  const bidsByUser = new Map<string, any>();
  bids.forEach(bid => {
    const userId = bid.user_id;
    const existingBid = bidsByUser.get(userId);
    if (!existingBid || bid.amount > existingBid.amount) {
      bidsByUser.set(userId, bid);
    }
  });
  
  // Convert back to array and sort by amount descending
  const uniqueBids = Array.from(bidsByUser.values());
  return uniqueBids.sort((a, b) => b.amount - a.amount);
}

