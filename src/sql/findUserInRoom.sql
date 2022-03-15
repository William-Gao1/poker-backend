with ids as (SELECT trim('"' FROM (d.value::jsonb->'id')::text) as value, active_id, players, id
FROM (select * from poker.room where status!='DONE') as q
JOIN jsonb_each_text(q.players) d ON true
ORDER BY 1)
SELECT * FROM ids WHERE value = $1