SELECT e.source source, sm.raw_family rawFamily, sm.raw_label rawLabel,
             COUNT(*) events, SUM(CASE WHEN e.event_type='trade' THEN 1 ELSE 0 END) trades,
             SUM(COALESCE(e.notional,0)) notional,
             SUM(CASE WHEN e.volume_share IS NOT NULL AND e.volume_share >= 0.1 THEN 1 ELSE 0 END) concentratedPrints
      FROM market_microstructure_events e
      JOIN source_markets sm ON sm.id = e.source_market_id
      JOIN market_instruments mi ON mi.id = e.instrument_id
      WHERE mi.family = 'player-prop'
      GROUP BY e.source, sm.raw_family
