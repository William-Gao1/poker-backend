UPDATE room
SET players=$1, num_players = $2, owner = $4
WHERE id=$3