"""
Spotify Preview API
Fetch data directly from Spotify for preview/comparison purposes
without ingesting into the database.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from app.core.config import settings

router = APIRouter()


def verify_admin(x_admin_token: str = Header(None)):
    """Verify admin token from request header against configured password."""
    if not settings.ADMIN_PASSWORD:
        print("CRITICAL ERROR: ADMIN_PASSWORD is not set in environment!")
        raise HTTPException(status_code=500, detail="Server misconfiguration")
    if x_admin_token != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Not authorized")
    return True


def get_spotify_client():
    """Get authenticated Spotify client"""
    import spotipy
    from spotipy.oauth2 import SpotifyClientCredentials

    client_credentials_manager = SpotifyClientCredentials(
        client_id=settings.SPOTIPY_CLIENT_ID,
        client_secret=settings.SPOTIPY_CLIENT_SECRET
    )
    return spotipy.Spotify(client_credentials_manager=client_credentials_manager)


@router.get("/artist/{spotify_id}/albums")
def get_artist_albums(
    spotify_id: str,
    _: bool = Depends(verify_admin)
):
    """
    Fetch all albums for a Spotify artist.
    Returns albums with basic metadata for preview/comparison.
    """
    try:
        sp = get_spotify_client()

        # Fetch artist albums (albums and singles, Swedish market)
        results = sp.artist_albums(
            spotify_id,
            album_type='album,single',
            country='SE',
            limit=50
        )

        albums = []
        for item in results['items']:
            albums.append({
                'spotify_id': item['id'],
                'title': item['name'],
                'release_date': item.get('release_date'),
                'total_tracks': item.get('total_tracks', 0),
                'cover_image_url': item['images'][0]['url'] if item.get('images') else None,
                'spotify_url': item['external_urls']['spotify'],
                'album_type': item['album_type'],  # 'album' or 'single'
            })

        # Handle pagination
        while results['next']:
            results = sp.next(results)
            for item in results['items']:
                albums.append({
                    'spotify_id': item['id'],
                    'title': item['name'],
                    'release_date': item.get('release_date'),
                    'total_tracks': item.get('total_tracks', 0),
                    'cover_image_url': item['images'][0]['url'] if item.get('images') else None,
                    'spotify_url': item['external_urls']['spotify'],
                    'album_type': item['album_type'],
                })

        return {
            'spotify_id': spotify_id,
            'albums': albums,
            'total': len(albums)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch albums from Spotify: {str(e)}"
        )


@router.get("/album/{spotify_id}/tracks")
def get_album_tracks(
    spotify_id: str,
    _: bool = Depends(verify_admin)
):
    """
    Fetch all tracks for a Spotify album.
    Returns tracks with basic metadata for preview/comparison.
    """
    try:
        sp = get_spotify_client()

        # Fetch album details
        album = sp.album(spotify_id)

        # Fetch all tracks (handle pagination)
        tracks = []
        results = album['tracks']

        for item in results['items']:
            tracks.append({
                'spotify_id': item['id'],
                'title': item['name'],
                'artists': [artist['name'] for artist in item.get('artists', [])],
                'duration_ms': item.get('duration_ms'),
                'track_number': item.get('track_number'),
                'spotify_url': item['external_urls']['spotify'],
                'preview_url': item.get('preview_url'),
            })

        # Handle pagination
        while results['next']:
            results = sp.next(results)
            for item in results['items']:
                tracks.append({
                    'spotify_id': item['id'],
                    'title': item['name'],
                    'artists': [artist['name'] for artist in item.get('artists', [])],
                    'duration_ms': item.get('duration_ms'),
                    'track_number': item.get('track_number'),
                    'spotify_url': item['external_urls']['spotify'],
                    'preview_url': item.get('preview_url'),
                })

        return {
            'spotify_id': spotify_id,
            'album_title': album['name'],
            'cover_image_url': album['images'][0]['url'] if album.get('images') else None,
            'tracks': tracks,
            'total': len(tracks)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch tracks from Spotify: {str(e)}"
        )
