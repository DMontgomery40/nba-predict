SELECT g.id game_id, g.scheduled_start scheduledStart,
             (SELECT gs.started_at FROM game_states gs WHERE gs.game_id=g.id AND gs.started_at IS NOT NULL ORDER BY gs.captured_at ASC LIMIT 1) startedAt,
             (SELECT gs.final_at FROM game_states gs WHERE gs.game_id=g.id AND gs.is_final=1 AND gs.final_at IS NOT NULL ORDER BY gs.captured_at DESC LIMIT 1) finalAt,
             go.final_home_score finalHome, go.final_away_score finalAway, go.winner_key winnerKey,
             g.home_participant_json homeJson, g.away_participant_json awayJson
      FROM games g JOIN game_outcomes go ON go.game_id=g.id
