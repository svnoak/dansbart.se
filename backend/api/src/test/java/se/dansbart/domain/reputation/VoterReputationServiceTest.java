package se.dansbart.domain.reputation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import se.dansbart.domain.user.User;
import se.dansbart.domain.user.UserJooqRepository;
import se.dansbart.voter.VoterContext;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoterReputationServiceTest {

    @Mock
    private VoterReputationJooqRepository reputationRepository;

    @Mock
    private UserJooqRepository userJooqRepository;

    @Mock
    private VoterContext voterContext;

    private VoterReputationService service() {
        return new VoterReputationService(reputationRepository, userJooqRepository, voterContext);
    }

    @Test
    void getWeightForVoter_unknownId_returnsAnonymousWeight() {
        UUID voterId = UUID.randomUUID();
        lenient().when(userJooqRepository.findById(voterId)).thenReturn(Optional.empty());

        BigDecimal weight = service().getWeightForVoter(voterId);

        assertEquals(VoterReputationService.ANONYMOUS_WEIGHT, weight);
    }

    @Test
    void getWeightForVoter_userWithoutReputation_returnsUserBase() {
        UUID voterId = UUID.randomUUID();
        User user = User.builder().id(voterId).role("USER").build();
        when(userJooqRepository.findById(voterId)).thenReturn(Optional.of(user));
        when(userJooqRepository.findRoleById(voterId)).thenReturn("USER");
        when(reputationRepository.findMultiplierByVoterId(voterId)).thenReturn(Optional.empty());

        BigDecimal weight = service().getWeightForVoter(voterId);

        assertEquals(VoterReputationService.USER_BASE, weight);
    }

    @Test
    void getWeightForVoter_userWithReputation_returnsUserBaseTimesMultiplier() {
        UUID voterId = UUID.randomUUID();
        BigDecimal multiplier = new BigDecimal("1.5");
        User user = User.builder().id(voterId).role("USER").build();
        lenient().when(userJooqRepository.findById(voterId)).thenReturn(Optional.of(user));
        when(userJooqRepository.findRoleById(voterId)).thenReturn("USER");
        when(reputationRepository.findMultiplierByVoterId(voterId)).thenReturn(Optional.of(multiplier));

        BigDecimal weight = service().getWeightForVoter(voterId);

        BigDecimal expected = VoterReputationService.USER_BASE.multiply(multiplier);
        assertEquals(expected, weight);
    }
}
