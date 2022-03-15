INSERT INTO room(deck, status, big_blind, small_blind, owner, players, active_id, action_max_time, max_players, num_players, buy_in)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *