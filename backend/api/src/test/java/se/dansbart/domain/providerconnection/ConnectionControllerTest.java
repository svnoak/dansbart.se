package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import se.dansbart.config.SecurityConfig;
import se.dansbart.voter.VoterContext;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ConnectionController.class)
@Import(SecurityConfig.class)
@ActiveProfiles("securityfilterchaintest")
class ConnectionControllerTest {

    private static final String SUCCESS_URL = "/mina-latar";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GoogleConnectionService googleConnectionService;

    @MockBean
    private VoterContext voterContext;

    private final UUID userId = UUID.randomUUID();

    private UsernamePasswordAuthenticationToken signedIn() {
        return new UsernamePasswordAuthenticationToken(userId, null, List.of());
    }

    @Test
    void startRedirectsToGoogle() throws Exception {
        URI googleUri = URI.create("https://accounts.google.com/o/oauth2/v2/auth?state=abc");
        when(googleConnectionService.start(any(), any())).thenReturn(googleUri);

        mockMvc.perform(get("/api/connections/google/start").with(authentication(signedIn())))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", googleUri.toString()));
    }

    @Test
    void startNeedsASignedInPerson() throws Exception {
        mockMvc.perform(get("/api/connections/google/start"))
            .andExpect(status().isUnauthorized());

        verifyNoInteractions(googleConnectionService);
    }

    @Test
    void startAnswersUnavailableWhenGoogleIsNotConfigured() throws Exception {
        when(googleConnectionService.start(any(), any())).thenThrow(new GoogleNotConfiguredException());

        mockMvc.perform(get("/api/connections/google/start").with(authentication(signedIn())))
            .andExpect(status().isServiceUnavailable());
    }

    @Test
    void callbackRedirectsToMinaLatarWhenConnected() throws Exception {
        when(googleConnectionService.callback(any(), any(), any(), any(), any()))
            .thenReturn(CallbackOutcome.CONNECTED);

        mockMvc.perform(get("/api/connections/google/callback")
                .param("state", "s").param("code", "c")
                .with(authentication(signedIn())))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", SUCCESS_URL));
    }

    @Test
    void callbackRedirectsWithAvbrutenWhenDeclined() throws Exception {
        when(googleConnectionService.callback(any(), any(), any(), any(), any()))
            .thenReturn(CallbackOutcome.DECLINED);

        mockMvc.perform(get("/api/connections/google/callback")
                .param("state", "s").param("error", "access_denied")
                .with(authentication(signedIn())))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", SUCCESS_URL + "?anslutning=avbruten"));
    }

    @Test
    void callbackRedirectsWithMisslyckadesWhenFailedOrRejected() throws Exception {
        when(googleConnectionService.callback(any(), any(), any(), any(), any()))
            .thenReturn(CallbackOutcome.FAILED, CallbackOutcome.REJECTED);

        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(get("/api/connections/google/callback")
                    .param("state", "s").param("code", "c")
                    .with(authentication(signedIn())))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", SUCCESS_URL + "?anslutning=misslyckades"));
        }
    }

    @Test
    void callbackWorksWithoutASignedInPerson() throws Exception {
        when(googleConnectionService.callback(any(), any(), any(), any(), any()))
            .thenReturn(CallbackOutcome.REJECTED);

        mockMvc.perform(get("/api/connections/google/callback")
                .param("state", "s").param("code", "c"))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", SUCCESS_URL + "?anslutning=misslyckades"));

        verify(googleConnectionService).callback(isNull(), any(), any(), any(), any());
        verify(googleConnectionService, never()).start(any(), any());
    }
}
