import { faro, LogLevel } from '@grafana/faro-web-sdk';

type PlayerContext = Record<string, string>;

export function pushPlayerEvent(name: string, context?: PlayerContext) {
  faro.api.pushLog([name], { level: LogLevel.WARN, context: { ...context, player_event: name } });
}

export function pushPlayerError(error: Error, context?: PlayerContext) {
  faro.api.pushError(error, { context });
}
