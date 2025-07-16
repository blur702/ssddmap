/**
 * Copy Utility - Handles copying text to clipboard with user feedback
 */
export class CopyUtility {
  constructor () {
    this.feedbackElement = null;
    this.setupCopyListeners();
  }

  /**
   * Setup global copy button listeners
   */
  setupCopyListeners () {
    document.addEventListener('click', (e) => {
      if (e.target.matches('.copy-address-btn, .mini-copy-btn') ||
          e.target.closest('.copy-address-btn, .mini-copy-btn')) {
        e.preventDefault();

        const button = e.target.matches('.copy-address-btn, .mini-copy-btn')
          ? e.target
          : e.target.closest('.copy-address-btn, .mini-copy-btn');

        const textToCopy = button.dataset.copyText;
        if (textToCopy) {
          this.copyToClipboard(textToCopy);
        }
      }
    });
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   */
  async copyToClipboard (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Use modern clipboard API
        await navigator.clipboard.writeText(text);
        this.showFeedback('📋 Copied to clipboard!');
      } else {
        // Fallback for older browsers
        this.fallbackCopyToClipboard(text);
        this.showFeedback('📋 Copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showFeedback('❌ Copy failed', 'error');
    }
  }

  /**
   * Fallback copy method for older browsers
   * @param {string} text - Text to copy
   */
  fallbackCopyToClipboard (text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  /**
   * Show copy feedback to user
   * @param {string} message - Feedback message
   * @param {string} type - Message type ('success' or 'error')
   */
  showFeedback (message, type = 'success') {
    // Remove existing feedback
    if (this.feedbackElement) {
      this.feedbackElement.remove();
    }

    // Create feedback element
    this.feedbackElement = document.createElement('div');
    this.feedbackElement.className = `copy-feedback ${type}`;
    this.feedbackElement.textContent = message;

    document.body.appendChild(this.feedbackElement);

    // Show feedback
    requestAnimationFrame(() => {
      this.feedbackElement.classList.add('show');
    });

    // Hide feedback after 2 seconds
    setTimeout(() => {
      if (this.feedbackElement) {
        this.feedbackElement.classList.remove('show');
        setTimeout(() => {
          if (this.feedbackElement) {
            this.feedbackElement.remove();
            this.feedbackElement = null;
          }
        }, 300);
      }
    }, 2000);
  }
}

// Initialize copy utility when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const copyUtility = new CopyUtility();
  window.copyUtility = copyUtility;
});

