WITH pbp AS (SELECT DISTINCT game_id FROM nba_play_by_play_actions),
      shared AS (
        SELECT sm.instrument_id iid
        FROM source_markets sm
        JOIN market_instruments mi ON mi.id = sm.instrument_id
        JOIN pbp ON pbp.game_id = sm.game_id
        WHERE mi.family = 'player-prop'
        GROUP BY sm.instrument_id
        HAVING COUNT(DISTINCT sm.source) >= 2
      )
      SELECT sm.instrument_id iid, sm.source source,
             (CAST(strftime('%s', q.captured_at) AS INTEGER) / 60) bucket,
             AVG(q.implied_probability) p
      FROM source_markets sm
      JOIN shared ON shared.iid = sm.instrument_id
      JOIN quote_ticks q ON q.source_market_id = sm.id
      WHERE q.implied_probability IS NOT NULL
      GROUP BY sm.instrument_id, sm.source, bucket
      ORDER BY sm.instrument_id, bucket
