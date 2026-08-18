package se.dansbart.domain.reputation;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.voter.VoterContext;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Computes vote weight per voter tier (anonymous / authenticated user / admin) and
 * tracks a per-authenticated-voter reputation multiplier that rewards consistently
 * useful contributions.
 *
 * CONFIRMATION_THRESHOLD is deliberately low (equal to ANONYMOUS_WEIGHT): a single
 * anonymous vote is enough to confirm a style for display. RETRAINING_THRESHOLD is the
 * higher-trust gate for anything that feeds back into the ML model.
 */
@Service
@RequiredArgsConstructor
public class VoterReputationService {

    public static final BigDecimal ANONYMOUS_WEIGHT = new BigDecimal("1.0");
    public static final BigDecimal USER_BASE = new BigDecimal("2.0");
    public static final BigDecimal ADMIN_BASE = new BigDecimal("3.0");

    public static final BigDecimal CONFIRMATION_THRESHOLD = new BigDecimal("1.0");
    public static final BigDecimal RETRAINING_THRESHOLD = new BigDecimal("2.0");
    public static final BigDecimal MATCHING_THRESHOLD = new BigDecimal("1.0");
    public static final BigDecimal SUPPRESSION_THRESHOLD = new BigDecimal("2.0");

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

    @Transactional
    public void rewardCurrentVoter() {
        if (!voterContext.isAuthenticated()) return;
        String role = userJooqRepository.findRoleById(voterContext.getUserId());
        BigDecimal min = "ADMIN".equals(role) ? ADMIN_MULT_MIN : USER_MULT_MIN;
        BigDecimal max = "ADMIN".equals(role) ? ADMIN_MULT_MAX : USER_MULT_MAX;
        reputationRepository.adjustMultiplier(voterContext.getVoterId(), DELTA_CONFIRM, min, max);
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
