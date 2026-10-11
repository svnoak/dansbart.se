package se.dansbart.domain.reputation;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.voter.VoterContext;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Computes vote weight per voter tier (anonymous / authenticated user / admin) and
 * tracks a per-authenticated-voter reputation multiplier that rewards consistently
 * useful contributions.
 *
 * CONFIRMATION_THRESHOLD needs two anonymous votes, or one vote from a signed-in voter
 * at the lowest reputation, to confirm a style for display. RETRAINING_THRESHOLD is the
 * higher-trust gate for anything that feeds back into the ML model.
 */
@Service
@RequiredArgsConstructor
public class VoterReputationService {

    public static final BigDecimal ANONYMOUS_WEIGHT = new BigDecimal("0.3");
    public static final BigDecimal USER_BASE = new BigDecimal("2.0");
    public static final BigDecimal ADMIN_BASE = new BigDecimal("3.0");

    public static final BigDecimal CONFIRMATION_THRESHOLD = new BigDecimal("0.6");
    public static final BigDecimal RETRAINING_THRESHOLD = new BigDecimal("2.0");
    public static final BigDecimal MATCHING_THRESHOLD = new BigDecimal("0.3");
    public static final BigDecimal SUPPRESSION_THRESHOLD = new BigDecimal("0.6");

    /**
     * Gate for adding tracks to the catalog without an admin looking first. It is the same
     * retraining gate the votes use, applied to one person's own weight: a signed-in
     * account starts at exactly USER_BASE (2.0), so its first submissions go to an admin,
     * and every rewarded vote or approved submission lifts it above the gate. Admins
     * (ADMIN_BASE) are always above it.
     */
    public static final BigDecimal TRUSTED_CONTRIBUTOR_THRESHOLD = RETRAINING_THRESHOLD;

    private static final BigDecimal DELTA_CONFIRM = new BigDecimal("0.05");
    private static final BigDecimal USER_MULT_MIN = new BigDecimal("0.30");
    private static final BigDecimal USER_MULT_MAX = new BigDecimal("3.00");
    private static final BigDecimal ADMIN_MULT_MIN = new BigDecimal("1.00");
    private static final BigDecimal ADMIN_MULT_MAX = new BigDecimal("5.00");

    private final VoterReputationJooqRepository reputationRepository;
    private final UserJooqRepository userJooqRepository;
    private final VoterContext voterContext;

    public BigDecimal getWeightForCurrentVoter() {
        if (!voterContext.isAuthenticated()) return ANONYMOUS_WEIGHT;
        String role = userJooqRepository.findRoleById(voterContext.getUserId());
        BigDecimal base = "ADMIN".equals(role) ? ADMIN_BASE : USER_BASE;
        BigDecimal mult = reputationRepository
            .findMultiplierByVoterId(voterContext.getVoterId())
            .orElse(BigDecimal.ONE);
        return base.multiply(mult);
    }

    /**
     * Whether the current voter may add tracks that go straight to analysis. Anonymous
     * voters never are; a signed-in person is once their weight is above
     * TRUSTED_CONTRIBUTOR_THRESHOLD (strictly, see the constant).
     */
    public boolean isTrustedContributor() {
        if (!voterContext.isAuthenticated()) return false;
        return getWeightForCurrentVoter().compareTo(TRUSTED_CONTRIBUTOR_THRESHOLD) > 0;
    }

    public BigDecimal getWeightForVoter(UUID voterId) {
        Optional<User> user = userJooqRepository.findById(voterId);
        if (user.isEmpty()) return ANONYMOUS_WEIGHT;
        String role = userJooqRepository.findRoleById(voterId);
        BigDecimal multiplier = reputationRepository
            .findMultiplierByVoterId(voterId)
            .orElse(BigDecimal.ONE);
        return weightFor(role, multiplier);
    }

    private BigDecimal weightFor(String role, BigDecimal multiplier) {
        BigDecimal base = "ADMIN".equals(role) ? ADMIN_BASE : USER_BASE;
        return base.multiply(multiplier);
    }

    @Transactional
    public void rewardCurrentVoter() {
        if (!voterContext.isAuthenticated()) return;
        String role = userJooqRepository.findRoleById(voterContext.getUserId());
        BigDecimal min = "ADMIN".equals(role) ? ADMIN_MULT_MIN : USER_MULT_MIN;
        BigDecimal max = "ADMIN".equals(role) ? ADMIN_MULT_MAX : USER_MULT_MAX;
        reputationRepository.adjustMultiplier(voterContext.getVoterId(), DELTA_CONFIRM, min, max);
    }

    /**
     * Reward one signed-in voter by the same step as a rewarded vote, for example when an
     * admin approves a track they submitted. Anonymous voter ids are ignored.
     */
    @Transactional
    public void rewardVoter(UUID voterId) {
        if (voterId == null) return;
        rewardUpvoters(List.of(voterId));
    }

    @Transactional
    public void rewardUpvoters(List<UUID> voterIds) {
        if (voterIds.isEmpty()) return;
        Set<UUID> existingUserIds = userJooqRepository.findExistingIds(voterIds);
        for (UUID id : existingUserIds) {
            String role = userJooqRepository.findRoleById(id);
            BigDecimal min = "ADMIN".equals(role) ? ADMIN_MULT_MIN : USER_MULT_MIN;
            BigDecimal max = "ADMIN".equals(role) ? ADMIN_MULT_MAX : USER_MULT_MAX;
            reputationRepository.adjustMultiplier(id, DELTA_CONFIRM, min, max);
        }
    }
}
