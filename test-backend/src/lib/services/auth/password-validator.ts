export interface PasswordValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export class PasswordValidator {
  private readonly commonPasswords = [
    'Password123!',
    'Password1!',
    'Admin123!',
    'Welcome123!',
  ];

  /**
   * Validate password strength
   * Requirements:
   * - Minimum 12 characters
   * - Maximum 100 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   * - Not in common passwords list
   */
  validatePassword(password: string): PasswordValidationResult {
    if (!password || password.trim().length === 0) {
      return {
        isValid: false,
        errorMessage: 'Password is required',
      };
    }

    if (password.length < 12) {
      return {
        isValid: false,
        errorMessage: 'Password must be at least 12 characters long',
      };
    }

    if (password.length > 100) {
      return {
        isValid: false,
        errorMessage: 'Password must not exceed 100 characters',
      };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        errorMessage: 'Password must contain at least one uppercase letter',
      };
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        errorMessage: 'Password must contain at least one lowercase letter',
      };
    }

    // Check for at least one digit
    if (!/[0-9]/.test(password)) {
      return {
        isValid: false,
        errorMessage: 'Password must contain at least one number',
      };
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return {
        isValid: false,
        errorMessage: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;\':",./<>?)',
      };
    }

    // Check against common passwords
    if (this.commonPasswords.some(common => common.toLowerCase() === password.toLowerCase())) {
      return {
        isValid: false,
        errorMessage: 'Password is too common. Please choose a more unique password',
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const passwordValidator = new PasswordValidator();
