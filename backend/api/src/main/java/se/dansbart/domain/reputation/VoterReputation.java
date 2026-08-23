package se.dansbart.domain.reputation;

import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoterReputation {

    private UUID voterId;
    private BigDecimal multiplier;
    private OffsetDateTime updatedAt;
}
