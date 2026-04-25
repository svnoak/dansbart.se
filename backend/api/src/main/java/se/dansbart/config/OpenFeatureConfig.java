package se.dansbart.config;

import dev.openfeature.sdk.Client;
import dev.openfeature.sdk.OpenFeatureAPI;
import dev.openfeature.sdk.providers.memory.Flag;
import dev.openfeature.sdk.providers.memory.InMemoryProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class OpenFeatureConfig {

    @Bean
    public Client openFeatureClient() {
        Map<String, Flag<?>> flags = Map.of(
            FeatureFlags.EXPLORER_PAGE, Flag.<Boolean>builder()
                .variant("on", true)
                .variant("off", false)
                .defaultVariant("off")
                .build(),
            FeatureFlags.DISCOVERY_V2, Flag.<Boolean>builder()
                .variant("on", true)
                .variant("off", false)
                .defaultVariant("off")
                .build(),
            FeatureFlags.FEEDBACK_ENABLED, Flag.<Boolean>builder()
                .variant("on", true)
                .variant("off", false)
                .defaultVariant("on")
                .build()
        );

        OpenFeatureAPI api = OpenFeatureAPI.getInstance();
        api.setProviderAndWait(new InMemoryProvider(flags));
        return api.getClient();
    }
}
