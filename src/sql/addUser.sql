INSERT INTO app_user (username, email, password, money)
VALUES ($1, $2, $3, $4)
RETURNING *