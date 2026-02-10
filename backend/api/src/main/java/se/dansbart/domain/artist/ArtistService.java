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

    private final ArtistJooqRepository artistJooqRepository;

    public Optional<Artist> findById(UUID id) {
        return artistJooqRepository.findById(id);
    }

    public Page<Artist> findAll(Pageable pageable) {
        return artistJooqRepository.findAll(pageable);
    }

    public Page<Artist> searchByName(String query, Pageable pageable) {
        return artistJooqRepository.searchByName(query, pageable);
    }

    public Page<Artist> findVerifiedArtists(Pageable pageable) {
        return artistJooqRepository.findVerifiedArtists(pageable);
    }
}
