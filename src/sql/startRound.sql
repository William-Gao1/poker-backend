UPDATE room SET players = $1, pot = $2, turn = $3, minimum_call = $4, deck = $5, action_start_time = $6, community_cards = '{}'
WHERE id = $7
RETURNING *