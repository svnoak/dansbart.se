package se.dansbart.domain.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByUsername(String username);

    @Query("SELECT u FROM User u WHERE LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<User> searchByUsernameOrDisplayName(@Param("query") String query, Pageable pageable);

    @Query("SELECT COUNT(u) FROM User u WHERE LOWER(u.username) = LOWER(:username)")
    long countByUsernameCaseInsensitive(@Param("username") String username);

    @Query("SELECT COUNT(u) FROM User u WHERE LOWER(u.username) = LOWER(:username) AND u.id != :excludeUserId")
    long countByUsernameCaseInsensitiveExcluding(@Param("username") String username, @Param("excludeUserId") String excludeUserId);
}
