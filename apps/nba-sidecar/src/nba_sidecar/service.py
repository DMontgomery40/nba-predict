from __future__ import annotations

from dataclasses import dataclass

from nba_api.live.nba.endpoints import boxscore, playbyplay, scoreboard
from nba_api.stats.endpoints import scoreboardv2

from .models import BoxScoreResponse, PlayByPlayResponse, ScoreboardResponse
from .normalizers import (
    is_today,
    normalize_live_boxscore_payload,
    normalize_live_playbyplay_payload,
    normalize_live_scoreboard_payload,
    normalize_stats_scoreboard_payload,
)


@dataclass(slots=True)
class NbaSidecarService:
    def get_scoreboard(self, requested_date: str | None = None) -> ScoreboardResponse:
        if requested_date and not is_today(requested_date):
            payload = scoreboardv2.ScoreboardV2(
                game_date=requested_date,
                day_offset=0,
                league_id="00",
            ).get_dict()
            return normalize_stats_scoreboard_payload(payload, requested_date=requested_date)

        payload = scoreboard.ScoreBoard().get_dict()
        return normalize_live_scoreboard_payload(payload, requested_date=requested_date)

    def get_game(self, game_id: str) -> BoxScoreResponse:
        payload = boxscore.BoxScore(game_id=game_id).get_dict()
        return normalize_live_boxscore_payload(game_id=game_id, payload=payload)

    def get_play_by_play(self, game_id: str) -> PlayByPlayResponse:
        payload = playbyplay.PlayByPlay(game_id=game_id).get_dict()
        return normalize_live_playbyplay_payload(game_id=game_id, payload=payload)

