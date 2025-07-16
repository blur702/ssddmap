/**
 * Address Resolution Module - Intelligent address resolution using USPS + Gemini AI
 * This module attempts to get ZIP+4 from USPS, and uses Gemini AI to correct addresses when USPS fails
 */
export class AddressResolutionModule {
    constructor(eventBus = null) {
        this.eventBus = eventBus;
        this.callbacks = {};
        this.geminiApiKey = 'AIzaSyC7nK_qiB740OouZ-hjUv-RD2FdfbL97ak';
        this.maxRetries = 3; // Maximum number of Gemini correction attempts
        this.debug = true; // Enable detailed logging
    }

    /**
     * Resolve an address to get ZIP+4 using USPS + Gemini AI correction
     * @param {string} originalAddress - The original address to resolve
     * @returns {Object} Resolution result with ZIP+4 and standardized address
     */
    async resolveAddress(originalAddress) {
        if (this.debug) {
            console.log('🔍 Starting address resolution for:', originalAddress);
        }

        const result = {
            success: false,
            originalAddress: originalAddress,
            finalAddress: null,
            zip4: null,
            uspsData: null,
            geminiCorrections: [],
            attempts: 0,
            error: null
        };

        try {
            // First attempt: Try original address with USPS
            const uspsResult = await this.tryUSPS(originalAddress);
            result.attempts++;

            if (uspsResult.success && uspsResult.zip4) {
                // Success on first try!
                result.success = true;
                result.finalAddress = uspsResult.standardizedAddress;
                result.zip4 = uspsResult.zip4;
                result.uspsData = uspsResult.data;
                
                if (this.debug) {
                    console.log('✅ USPS success on first attempt:', result);
                }
                return result;
            }

            // USPS failed - try Gemini AI corrections
            if (this.debug) {
                console.log('❌ USPS failed, trying Gemini AI corrections...');
            }

            let currentAddress = originalAddress;
            
            for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
                result.attempts++;
                
                if (this.debug) {
                    console.log(`🤖 Gemini correction attempt ${attempt}/${this.maxRetries}`);
                }

                // Get Gemini correction
                const geminiCorrection = await this.getGeminiCorrection(currentAddress, uspsResult.error);
                
                if (!geminiCorrection.success) {
                    if (this.debug) {
                        console.log('❌ Gemini correction failed:', geminiCorrection.error);
                    }
                    continue;
                }

                result.geminiCorrections.push({
                    attempt: attempt,
                    original: currentAddress,
                    corrected: geminiCorrection.correctedAddress,
                    reasoning: geminiCorrection.reasoning
                });

                // Try USPS with corrected address
                const correctedUSPSResult = await this.tryUSPS(geminiCorrection.correctedAddress);
                
                if (correctedUSPSResult.success && correctedUSPSResult.zip4) {
                    // Success with corrected address!
                    result.success = true;
                    result.finalAddress = correctedUSPSResult.standardizedAddress;
                    result.zip4 = correctedUSPSResult.zip4;
                    result.uspsData = correctedUSPSResult.data;
                    
                    if (this.debug) {
                        console.log(`✅ Success with Gemini correction on attempt ${attempt}:`, result);
                    }
                    return result;
                }

                // Update current address for next attempt
                currentAddress = geminiCorrection.correctedAddress;
                
                if (this.debug) {
                    console.log(`❌ USPS still failed with corrected address: ${currentAddress}`);
                }
            }

            // All attempts failed
            result.error = 'Failed to resolve address after all attempts';
            
            if (this.debug) {
                console.log('❌ All resolution attempts failed:', result);
            }

        } catch (error) {
            result.error = error.message;
            if (this.debug) {
                console.error('❌ Address resolution error:', error);
            }
        }

        return result;
    }

    /**
     * Try to get ZIP+4 from USPS API
     * @param {string} address - Address to validate
     * @returns {Object} USPS result
     */
    async tryUSPS(address) {
        try {
            if (this.debug) {
                console.log('📮 Trying USPS with address:', address);
            }

            const response = await fetch('/ssddmap/api/validate-address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    address: address,
                    apis: ['usps'] // Use only USPS for this workflow
                })
            });

            if (!response.ok) {
                throw new Error(`USPS API error: ${response.status}`);
            }

            const data = await response.json();

            // Check if USPS method succeeded in the validation response
            if (data.methods && data.methods.usps && data.methods.usps.success) {
                const uspsData = data.methods.usps;
                const standardizedAddress = uspsData.standardized ? 
                    `${uspsData.standardized.street}, ${uspsData.standardized.city}, ${uspsData.standardized.state} ${uspsData.standardized.zip}` :
                    address;
                
                return {
                    success: true,
                    standardizedAddress: standardizedAddress,
                    zip4: uspsData.standardized?.zip4 || uspsData.standardized?.zip,
                    data: data,
                    error: null
                };
            } else {
                // Return USPS error if available
                const uspsError = data.methods && data.methods.usps ? data.methods.usps.error : 'USPS validation failed';
                return {
                    success: false,
                    standardizedAddress: null,
                    zip4: null,
                    data: data,
                    error: uspsError
                };
            }

        } catch (error) {
            if (this.debug) {
                console.error('📮 USPS error:', error);
            }
            return {
                success: false,
                standardizedAddress: null,
                zip4: null,
                data: null,
                error: error.message
            };
        }
    }

    /**
     * Get address correction from Gemini AI
     * @param {string} address - Address that failed USPS validation
     * @param {string} uspsError - Error message from USPS
     * @returns {Object} Gemini correction result
     */
    async getGeminiCorrection(address, uspsError) {
        try {
            if (this.debug) {
                console.log('🤖 Requesting Gemini correction for:', address);
            }

            const prompt = this.buildGeminiPrompt(address, uspsError);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Invalid Gemini API response');
            }

            const responseText = data.candidates[0].content.parts[0].text;
            const parsed = this.parseGeminiResponse(responseText);

            if (this.debug) {
                console.log('🤖 Gemini response:', parsed);
            }

            return parsed;

        } catch (error) {
            if (this.debug) {
                console.error('🤖 Gemini error:', error);
            }
            return {
                success: false,
                correctedAddress: null,
                reasoning: null,
                error: error.message
            };
        }
    }

    /**
     * Build prompt for Gemini AI address correction
     * @param {string} address - Failed address
     * @param {string} uspsError - USPS error message
     * @returns {string} Gemini prompt
     */
    buildGeminiPrompt(address, uspsError) {
        return `You are an expert address correction assistant. I need you to help correct a US postal address that failed USPS validation.

FAILED ADDRESS: "${address}"
USPS ERROR: "${uspsError || 'Address validation failed'}"

Please analyze this address and provide a corrected version that is more likely to pass USPS validation. Consider common address issues like:
- Misspelled street names
- Missing or incorrect directionals (N, S, E, W, NE, SW, etc.)
- Abbreviated vs full street types (St vs Street, Ave vs Avenue, etc.)
- Missing apartment/unit numbers
- Incorrect city names
- Wrong ZIP codes
- Formatting issues

Respond ONLY in this exact JSON format:
{
    "correctedAddress": "The corrected address here",
    "reasoning": "Brief explanation of what you changed and why"
}

Do not include any other text or formatting. The correctedAddress should be a complete, properly formatted US postal address.`;
    }

    /**
     * Parse Gemini AI response
     * @param {string} responseText - Raw response from Gemini
     * @returns {Object} Parsed correction result
     */
    parseGeminiResponse(responseText) {
        try {
            // Clean up the response text
            const cleanedText = responseText.trim();
            
            // Try to extract JSON from the response
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in Gemini response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            if (!parsed.correctedAddress) {
                throw new Error('No correctedAddress in Gemini response');
            }

            return {
                success: true,
                correctedAddress: parsed.correctedAddress,
                reasoning: parsed.reasoning || 'No reasoning provided',
                error: null
            };

        } catch (error) {
            return {
                success: false,
                correctedAddress: null,
                reasoning: null,
                error: `Failed to parse Gemini response: ${error.message}`
            };
        }
    }

    /**
     * Get detailed resolution summary for display
     * @param {Object} result - Resolution result
     * @returns {string} Formatted summary
     */
    getResolutionSummary(result) {
        if (!result) return 'No resolution data available';

        let summary = `Address Resolution Summary:\n`;
        summary += `Original: ${result.originalAddress}\n`;
        summary += `Attempts: ${result.attempts}\n`;

        if (result.success) {
            summary += `✅ SUCCESS\n`;
            summary += `Final Address: ${result.finalAddress}\n`;
            summary += `ZIP+4: ${result.zip4}\n`;
            
            if (result.geminiCorrections.length > 0) {
                summary += `\nGemini Corrections Made:\n`;
                result.geminiCorrections.forEach((correction, index) => {
                    summary += `${index + 1}. ${correction.corrected}\n`;
                    summary += `   Reason: ${correction.reasoning}\n`;
                });
            }
        } else {
            summary += `❌ FAILED: ${result.error}\n`;
            
            if (result.geminiCorrections.length > 0) {
                summary += `\nGemini Attempts Made:\n`;
                result.geminiCorrections.forEach((correction, index) => {
                    summary += `${index + 1}. ${correction.corrected}\n`;
                });
            }
        }

        return summary;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Debug enabled
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    /**
     * Set maximum retry attempts
     * @param {number} maxRetries - Maximum retries
     */
    setMaxRetries(maxRetries) {
        this.maxRetries = Math.max(1, Math.min(10, maxRetries));
    }

    /**
     * Register callback functions
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    /**
     * Set event bus for communication
     * @param {Object} eventBus - Event bus instance
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
}