package se.dansbart.domain.artist;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ArtistService {

    private final ArtistRepository artistRepository;

    public Optional<Artist> findById(UUID id) {
        return artistRepository.findById(id);
    }

    public Page<Artist> findAll(Pageable pageable) {
        return artistRepository.findAll(pageable);
    }

    public Page<Artist> searchByName(String query, Pageable pageable) {
        return artistRepository.searchByName(query, pageable);
    }

    public Page<Artist> findVerifiedArtists(Pageable pageable) {
        return artistRepository.findVerifiedArtists(pageable);
    }
}
