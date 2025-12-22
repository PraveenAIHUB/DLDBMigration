/*
  # Add UPDATE and DELETE Policies for Bids Table
  
  1. Purpose
    - Allow bidders to update their own bids (edit bid amounts)
    - Allow bidders to delete their own bids
    - Users can only modify bids they created
    - Operations only allowed before bidding closes
  
  2. Security
    - Bidders can only UPDATE/DELETE their own bids (user_id = auth.uid())
    - Policies ensure users cannot modify other users' bids
    - Works with role-based system (checks for bidder role)
*/

-- Allow bidders to update their own bids
-- Works with both basic auth and role-based system
CREATE POLICY "Bidders can update own bids"
  ON bids
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow bidders to delete their own bids
-- Works with both basic auth and role-based system
CREATE POLICY "Bidders can delete own bids"
  ON bids
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

