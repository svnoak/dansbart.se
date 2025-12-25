from sqlalchemy.orm import Session
from app.core.models import DanceMovementFeedback, TrackDanceStyle
from app.core.music_theory import get_tempo_description
from app.repository.track import TrackRepository

class TrackService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = TrackRepository(db)

    def get_track_by_id(self, track_id: str):
        """
        Fetches a single track by ID for deep linking.
        Returns the same format as get_playable_tracks but for a single track.
        """
        from app.core.models import Track

        track = self.db.query(Track).options(*self.repo.get_eager_load_full()).filter(Track.id == track_id).first()
        if not track:
            return None

        # Filter broken links
        valid_links = [l for l in track.playback_links if l.is_working]
        if not valid_links:
            return None

        # Get primary style
        primary_style = next((s for s in track.dance_styles if s.is_primary), None)

        if primary_style:
            final_style = primary_style.dance_style
            final_sub_style = primary_style.sub_style
            final_bpm = primary_style.effective_bpm
            final_category = primary_style.tempo_category
            final_confidence = primary_style.confidence
            final_confirmations = primary_style.confirmation_count
            final_verifications = primary_style.is_user_confirmed
        else:
            final_style = "Unclassified"
            final_sub_style = None
            final_bpm = 0
            final_category = "Unknown"
            final_confidence = 0.0
            final_confirmations = 0
            final_verifications = False

        # Format artists
        sorted_artists = sorted(track.artist_links, key=lambda x: 0 if x.role == 'primary' else 1)
        artist_list = [{"id": l.artist.id, "name": l.artist.name, "role": l.role} for l in sorted_artists]

        # Format album
        album_data = None
        if track.album:
            album_data = {
                "id": track.album.id,
                "title": track.album.title
            }

        # Get feel tags
        style_feel_map = self._get_global_feels([final_style])
        tags = self._refine_tags_with_physics(style_feel_map.get(final_style, []), track.bounciness)

        # Secondary styles
        secondary_styles = [
            {
                "style": s.dance_style,
                "sub_style": s.sub_style,
                "effective_bpm": s.effective_bpm,
                "tempo": get_tempo_description(s.dance_style, s.effective_bpm),
                "confirmations": s.confirmation_count
            }
            for s in track.dance_styles if not s.is_primary
        ]

        # Tempo description
        tempo_data = get_tempo_description(final_style, final_bpm) if final_bpm else None

        return {
            "id": str(track.id),
            "title": track.title,
            "artists": artist_list,
            "album": album_data,
            "dance_style": final_style,
            "sub_style": final_sub_style,
            "feel_tags": tags,
            "effective_bpm": final_bpm,
            "tempo": tempo_data,
            "tempo_category": final_category,
            "style_confidence": final_confidence,
            "is_user_confirmed": final_verifications,
            "style_confirmations": final_confirmations,
            "secondary_styles": secondary_styles,
            "bars": track.bars,
            "sections": track.sections,
            "section_labels": track.section_labels,
            "swing_ratio": track.swing_ratio,
            "bounciness": track.bounciness,
            "has_vocals": track.has_vocals,
            "duration": track.duration_ms,
            "version_count": len(track.structure_versions),
            "playback_links": [{"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link} for l in valid_links]
        }

    def get_style_hierarchy(self):
        """
        Returns a tree of styles combining:
        - Main styles from StyleKeyword table (all possible categories)
        - Sub-styles from TrackDanceStyle table (what actually exists in tracks)

        Returns: {"Polska": ["Slängpolska", "Hambo"], "Schottis": ["Reinländer"], ...}
        """
        from app.core.models import StyleKeyword

        # 1. Get all unique main_style values from StyleKeyword table
        main_styles = (
            self.db.query(StyleKeyword.main_style)
            .filter(StyleKeyword.is_active == True)
            .distinct()
            .all()
        )

        # 2. Initialize hierarchy with all main styles
        hierarchy = {main[0]: set() for main in main_styles}

        # 3. Get ALL sub-styles in a single query (optimized from N+1 queries)
        all_sub_styles = (
            self.db.query(TrackDanceStyle.dance_style, TrackDanceStyle.sub_style)
            .filter(
                TrackDanceStyle.sub_style.isnot(None),
                TrackDanceStyle.confidence > 0.3
            )
            .distinct()
            .all()
        )

        # 4. Group sub-styles by main style
        for dance_style, sub_style in all_sub_styles:
            if dance_style in hierarchy and sub_style:
                hierarchy[dance_style].add(sub_style)

        # 5. Sort sub-style lists and convert sets to lists
        return {k: sorted(list(v)) for k, v in sorted(hierarchy.items())}

    def get_playable_tracks(
        self,
        main_style: str = None,
        sub_style: str = None,
        style_confirmed: bool = False,
        min_bpm: int = None,
        max_bpm: int = None,
        min_tempo: int = None,
        max_tempo: int = None,
        search: str = None,
        source: str = None,
        vocals: str = None,
        min_duration: int = None,
        max_duration: int = None,
        min_bounciness: float = None,
        max_bounciness: float = None,
        min_articulation: float = None,
        max_articulation: float = None,
        music_genre: str = None,
        sort_by: str = "confidence",
        sort_order: str = "desc",
        limit: int = 20,
        offset: int = 0
    ):
        """
        Fetches tracks for the feed.
        """
        
        # 1. PREPARE STYLE LOGIC
        exact_style = None
        exact_main_style = None

        if sub_style:
            # User wants a specific sub-style dance (e.g., "Reinländer")
            exact_style = sub_style

        elif main_style:
            # User wants all tracks from a main category (e.g., "Schottis")
            # We'll filter by dance_style matching the main_style exactly
            exact_main_style = main_style

        # 2. CALL REPO
        tracks, base_total = self.repo.search_playable_tracks(
            exact_style=exact_style,
            exact_main_style=exact_main_style,
            style_confirmed=style_confirmed,
            min_bpm=min_bpm,
            max_bpm=max_bpm,
            min_duration_ms=min_duration * 1000 if min_duration else None,
            max_duration_ms=max_duration * 1000 if max_duration else None,
            vocals=vocals,
            min_bounciness=min_bounciness,
            max_bounciness=max_bounciness,
            min_articulation=min_articulation,
            max_articulation=max_articulation,
            search=search,
            source=source,
            music_genre=music_genre,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )

        # 3. POST-PROCESSING (Tags, Formatting, Tempo Logic)
        
        # Gather styles for Tag Lookup
        visible_styles = set()
        for t in tracks:
            primary = next((s for s in t.dance_styles if s.is_primary), None)
            if primary: visible_styles.add(primary.dance_style)
        
        style_feel_map = self._get_global_feels(list(visible_styles))
        
        results = []
        filtered_count = 0

        for track in tracks:
            # Filter Broken Links
            valid_links = [l for l in track.playback_links if l.is_working]
            if not valid_links: continue

            # Determine Display Style
            primary_style = next((s for s in track.dance_styles if s.is_primary), None)
            matched_style = primary_style

            # Highlight specific style if filtered
            target_filter = sub_style or main_style
            if target_filter:
                specific = next((s for s in track.dance_styles if target_filter.lower() in s.dance_style.lower()), None)
                if specific: matched_style = specific

            # Map fields
            if matched_style:
                final_style = matched_style.dance_style
                final_sub_style = matched_style.sub_style
                final_bpm = matched_style.effective_bpm
                final_category = matched_style.tempo_category
                final_confidence = matched_style.confidence
                final_confirmations = matched_style.confirmation_count
                final_verifications = matched_style.is_user_confirmed
            else:
                final_style = "Unclassified"
                final_sub_style = None
                final_bpm = 0
                final_category = "Unknown"
                final_confidence = 0.0
                final_confirmations = 0
                final_verifications = False

            # Format Output
            sorted_artists = sorted(track.artist_links, key=lambda x: 0 if x.role == 'primary' else 1)
            artist_list = [{"id": l.artist.id, "name": l.artist.name, "role": l.role} for l in sorted_artists]

            album_data = None
            if track.album:
                album_data = {
                    "id": track.album.id,
                    "title": track.album.title
                }
            
            # Tags & Physics
            tags = self._refine_tags_with_physics(style_feel_map.get(final_style, []), track.bounciness)
            
            # Secondary Styles
            secondary_styles = [
                {
                    "style": s.dance_style, 
                    "sub_style": s.sub_style,
                    "effective_bpm": s.effective_bpm, 
                    "tempo": get_tempo_description(s.dance_style, s.effective_bpm),
                    "confirmations": s.confirmation_count
                }
                for s in track.dance_styles if not s.is_primary
            ]

            # Tempo Description
            tempo_data = get_tempo_description(final_style, final_bpm) if final_bpm else None

            # Post-Query Tempo Filtering (Level 1-5)
            if tempo_data and (min_tempo or max_tempo):
                lvl = tempo_data["level"]
                if (min_tempo and lvl < min_tempo) or (max_tempo and lvl > max_tempo):
                    filtered_count += 1
                    continue

            results.append({
                "id": str(track.id),
                "title": track.title,
                "artists": artist_list,
                "album": album_data,
                "dance_style": final_style,
                "sub_style": final_sub_style,
                "feel_tags": tags,
                "effective_bpm": final_bpm,
                "tempo": tempo_data,
                "tempo_category": final_category,
                "style_confidence": final_confidence,
                "is_user_confirmed": final_verifications,
                "style_confirmations": final_confirmations,
                "secondary_styles": secondary_styles,
                "bars": track.bars,
                "sections": track.sections,
                "section_labels": track.section_labels,
                "swing_ratio": track.swing_ratio,
                "bounciness": track.bounciness,
                "has_vocals": track.has_vocals,
                "duration": track.duration_ms,
                "version_count": len(track.structure_versions),
                "playback_links": [{"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link} for l in valid_links]
            })

        total_count = base_total - filtered_count if (min_tempo or max_tempo) else base_total

        return {
            "items": results,
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(results) < total_count
        }

    # ==================== HELPER METHODS ====================

    def format_track(self, track, matched_style=None):
        """
        Format a track object into the standard API response format.

        Args:
            track: Track model object with relationships loaded
            matched_style: Optional specific TrackDanceStyle to highlight (defaults to primary)

        Returns:
            Formatted track dictionary or None if track has no valid playback links
        """
        # Filter broken links
        valid_links = [l for l in track.playback_links if l.is_working]
        if not valid_links:
            return None

        # Determine Display Style
        primary_style = next((s for s in track.dance_styles if s.is_primary), None)
        if matched_style is None:
            matched_style = primary_style

        # Map fields
        if matched_style:
            final_style = matched_style.dance_style
            final_sub_style = matched_style.sub_style
            final_bpm = matched_style.effective_bpm
            final_category = matched_style.tempo_category
            final_confidence = matched_style.confidence
            final_confirmations = matched_style.confirmation_count
            final_verifications = matched_style.is_user_confirmed
        else:
            final_style = "Unclassified"
            final_sub_style = None
            final_bpm = 0
            final_category = "Unknown"
            final_confidence = 0.0
            final_confirmations = 0
            final_verifications = False

        # Format artists
        sorted_artists = sorted(track.artist_links, key=lambda x: 0 if x.role == 'primary' else 1)
        artist_list = [{"id": l.artist.id, "name": l.artist.name, "role": l.role} for l in sorted_artists]

        # Format album
        album_data = None
        if track.album:
            album_data = {
                "id": track.album.id,
                "title": track.album.title,
                "cover_image_url": track.album.cover_image_url
            }

        # Get feel tags
        style_feel_map = self._get_global_feels([final_style])
        tags = self._refine_tags_with_physics(style_feel_map.get(final_style, []), track.bounciness)

        # Secondary styles
        secondary_styles = [
            {
                "style": s.dance_style,
                "sub_style": s.sub_style,
                "effective_bpm": s.effective_bpm,
                "tempo": get_tempo_description(s.dance_style, s.effective_bpm),
                "confirmations": s.confirmation_count
            }
            for s in track.dance_styles if not s.is_primary
        ]

        # Tempo description
        tempo_data = get_tempo_description(final_style, final_bpm) if final_bpm else None

        return {
            "id": str(track.id),
            "title": track.title,
            "artists": artist_list,
            "album": album_data,
            "dance_style": final_style,
            "sub_style": final_sub_style,
            "feel_tags": tags,
            "effective_bpm": final_bpm,
            "tempo": tempo_data,
            "tempo_category": final_category,
            "style_confidence": final_confidence,
            "is_user_confirmed": final_verifications,
            "style_confirmations": final_confirmations,
            "secondary_styles": secondary_styles,
            "bars": track.bars,
            "sections": track.sections,
            "section_labels": track.section_labels,
            "swing_ratio": track.swing_ratio,
            "bounciness": track.bounciness,
            "has_vocals": track.has_vocals,
            "duration_ms": track.duration_ms,
            "version_count": len(track.structure_versions),
            "playback_links": [{"id": str(l.id), "platform": l.platform, "deep_link": l.deep_link} for l in valid_links]
        }

    def _get_global_feels(self, styles: list[str]) -> dict:
        """Returns: {'Hambo': ['Sviktande', 'Majestätisk'], ...}"""
        if not styles: return {}
        rows = (
            self.db.query(DanceMovementFeedback)
            .filter(DanceMovementFeedback.dance_style.in_(styles))
            .order_by(DanceMovementFeedback.score.desc())
            .all()
        )
        mapped = {}
        for r in rows:
            if r.dance_style not in mapped: mapped[r.dance_style] = []
            if len(mapped[r.dance_style]) < 3: mapped[r.dance_style].append(r.movement_tag)
        return mapped

    def _refine_tags_with_physics(self, global_tags: list[str], bounciness: float | None) -> list[str]:
        """Adjusts tags based on audio analysis (e.g. bounciness)."""
        if not bounciness: return global_tags
        tags = global_tags[:]
        
        # Physics Logic: Flat vs Bouncy
        if bounciness < 0.35 and "Studsigt" in tags:
            tags.remove("Studsigt")
            if "Flytande" not in tags: tags.append("Flytande")

        if bounciness > 0.65:
            if "Sviktande" in tags:
                tags.remove("Sviktande")
                tags.insert(0, "Sviktande")

        return tags[:3]

    def get_similar_tracks(self, track_id: str, limit: int = 10, style_filter: str = 'same'):
        """
        Find similar tracks using pgvector cosine similarity on audio embeddings.
        Returns source track info and list of similar tracks with similarity scores.

        Args:
            track_id: The source track ID
            limit: Number of similar tracks to return
            style_filter: 'same' (only same style), 'similar' (mix of styles), 'any' (all styles)
        """
        from app.core.models import Track
        from sqlalchemy import text

        # Get the source track
        source_track = self.get_track_by_id(track_id)
        if not source_track:
            return None

        # Get the embedding and primary style from database
        track_obj = self.db.query(Track).filter(Track.id == track_id).first()
        if not track_obj or track_obj.embedding is None:
            return None

        # Get the primary dance style for filtering
        primary_style = next((s for s in track_obj.dance_styles if s.is_primary), None)
        source_style = primary_style.dance_style if primary_style else None

        # Format embedding as string for pgvector: '[1.0,2.0,3.0]'
        embedding_str = '[' + ','.join(str(x) for x in track_obj.embedding) + ']'

        # Build query based on style filter
        if style_filter == 'same' and source_style:
            # Only tracks with the same dance style
            # Since is_primary=true, each track should appear once
            similar_results = self.db.execute(
                text("""
                    SELECT t.id, (1 - (t.embedding <=> CAST(:target_embedding AS vector))) as similarity
                    FROM tracks t
                    INNER JOIN track_dance_styles tds ON t.id = tds.track_id
                    WHERE t.id != :track_id
                      AND t.embedding IS NOT NULL
                      AND t.is_flagged = false
                      AND t.processing_status IN ('DONE', 'FAILED')
                      AND tds.dance_style = :source_style
                      AND tds.is_primary = true
                    ORDER BY t.embedding <=> CAST(:target_embedding AS vector)
                    LIMIT :limit
                """),
                {
                    "target_embedding": embedding_str,
                    "track_id": track_id,
                    "source_style": source_style,
                    "limit": limit
                }
            ).fetchall()

        elif style_filter == 'similar' and source_style:
            # Mix: 70% same style, 30% variety
            same_limit = int(limit * 0.7)
            variety_limit = limit - same_limit

            # Get same style tracks
            same_style_results = self.db.execute(
                text("""
                    SELECT t.id, (1 - (t.embedding <=> CAST(:target_embedding AS vector))) as similarity
                    FROM tracks t
                    INNER JOIN track_dance_styles tds ON t.id = tds.track_id
                    WHERE t.id != :track_id
                      AND t.embedding IS NOT NULL
                      AND t.is_flagged = false
                      AND t.processing_status IN ('DONE', 'FAILED')
                      AND tds.dance_style = :source_style
                      AND tds.is_primary = true
                    ORDER BY t.embedding <=> CAST(:target_embedding AS vector)
                    LIMIT :limit
                """),
                {
                    "target_embedding": embedding_str,
                    "track_id": track_id,
                    "source_style": source_style,
                    "limit": same_limit
                }
            ).fetchall()

            same_style_ids = [str(row.id) for row in same_style_results]

            # Get variety tracks (excluding same style tracks we already have)
            if same_style_ids:
                # Build exclusion list as comma-separated string for IN clause
                exclude_placeholders = ','.join([f':exclude_{i}' for i in range(len(same_style_ids))])
                variety_query = f"""
                    SELECT t.id, (1 - (t.embedding <=> CAST(:target_embedding AS vector))) as similarity
                    FROM tracks t
                    INNER JOIN track_dance_styles tds ON t.id = tds.track_id
                    WHERE t.id != :track_id
                      AND t.id NOT IN ({exclude_placeholders})
                      AND t.embedding IS NOT NULL
                      AND t.is_flagged = false
                      AND t.processing_status IN ('DONE', 'FAILED')
                      AND tds.dance_style != :source_style
                      AND tds.is_primary = true
                    ORDER BY t.embedding <=> CAST(:target_embedding AS vector)
                    LIMIT :limit
                """

                params = {
                    "target_embedding": embedding_str,
                    "track_id": track_id,
                    "source_style": source_style,
                    "limit": variety_limit
                }
                # Add each exclude ID as a separate parameter
                for i, exclude_id in enumerate(same_style_ids):
                    params[f'exclude_{i}'] = exclude_id

                variety_results = self.db.execute(text(variety_query), params).fetchall()
            else:
                # No same-style tracks found, just get variety tracks
                variety_results = self.db.execute(
                    text("""
                        SELECT t.id, (1 - (t.embedding <=> CAST(:target_embedding AS vector))) as similarity
                        FROM tracks t
                        INNER JOIN track_dance_styles tds ON t.id = tds.track_id
                        WHERE t.id != :track_id
                          AND t.embedding IS NOT NULL
                          AND t.is_flagged = false
                          AND t.processing_status IN ('DONE', 'FAILED')
                          AND tds.dance_style != :source_style
                          AND tds.is_primary = true
                        ORDER BY t.embedding <=> CAST(:target_embedding AS vector)
                        LIMIT :limit
                    """),
                    {
                        "target_embedding": embedding_str,
                        "track_id": track_id,
                        "source_style": source_style,
                        "limit": variety_limit
                    }
                ).fetchall()

            # Combine results
            similar_results = list(same_style_results) + list(variety_results)

        else:
            # 'any' filter or no source style - pure vector similarity
            similar_results = self.db.execute(
                text("""
                    SELECT id, (1 - (embedding <=> CAST(:target_embedding AS vector))) as similarity
                    FROM tracks
                    WHERE id != :track_id
                      AND embedding IS NOT NULL
                      AND is_flagged = false
                      AND processing_status IN ('DONE', 'FAILED')
                    ORDER BY embedding <=> CAST(:target_embedding AS vector)
                    LIMIT :limit
                """),
                {
                    "target_embedding": embedding_str,
                    "track_id": track_id,
                    "limit": limit
                }
            ).fetchall()

        # Fetch full track objects for the similar tracks
        similar_track_ids = [str(row.id) for row in similar_results]
        similarity_scores = {str(row.id): float(row.similarity) for row in similar_results}

        # Get full track data using the existing method
        similar_tracks = []
        for track_id_str in similar_track_ids:
            track_data = self.get_track_by_id(track_id_str)
            if track_data:
                # Add similarity score to the track data
                track_data["similarity_score"] = round(similarity_scores[track_id_str], 3)
                similar_tracks.append(track_data)

        return {
            "source_track": source_track,
            "similar_tracks": similar_tracks,
            "total": len(similar_tracks)
        }