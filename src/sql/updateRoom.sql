UPDATE room
SET deck = $1, pot = $2, players = $3, action_start_time = $4, turn = $5, community_cards = $6, minimum_call = $7
WHERE id = $8