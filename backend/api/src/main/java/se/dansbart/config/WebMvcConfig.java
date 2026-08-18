package se.dansbart.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import se.dansbart.voter.VoterContextInterceptor;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final VoterContextInterceptor voterContextInterceptor;

    public WebMvcConfig(VoterContextInterceptor voterContextInterceptor) {
        this.voterContextInterceptor = voterContextInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(voterContextInterceptor).addPathPatterns("/api/**");
    }
}
