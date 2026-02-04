package se.dansbart.domain.album;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AlbumService {

    private final AlbumRepository albumRepository;

    public Optional<Album> findById(UUID id) {
        return albumRepository.findById(id);
    }

    public Page<Album> findAll(Pageable pageable) {
        return albumRepository.findAll(pageable);
    }

    public List<Album> findByArtistId(UUID artistId) {
        return albumRepository.findByArtistIdOrderByReleaseDateDesc(artistId);
    }

    public Page<Album> searchByTitle(String query, Pageable pageable) {
        return albumRepository.searchByTitle(query, pageable);
    }
}
