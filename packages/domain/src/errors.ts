export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnsupportedChannelError extends DomainError {
  constructor(channel: string) {
    super("UNSUPPORTED_CHANNEL", `No processor registered for channel: ${channel}`);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}
