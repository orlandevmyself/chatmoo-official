const API_BASE = process.env.REACT_APP_API_URL || 'https://chatmoo-official.onrender.com';

export const paymongoApi = {
  // Create a payment intent
  createPaymentIntent: async (amount, currency, description, metadata) => {
    try {
      const response = await fetch(`${API_BASE}/paymongo/payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          description,
          metadata,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      // Check if response indicates an error (either HTTP error or API error)
      if (!response.ok) {
        throw new Error(data?.error || `Payment Intent Error: ${response.status} ${response.statusText}`);
      }

      // Check for API-level error (success: false)
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      // Validate response structure
      if (!data || !data.data) {
        throw new Error('Invalid response from payment intent endpoint');
      }

      return data.data;
    } catch (error) {
      console.error('Create Payment Intent Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create payment intent');
    }
  },

  // Attach payment method to payment intent
  attachPaymentMethod: async (paymentIntentId, paymentMethodId) => {
    try {
      const response = await fetch(
        `${API_BASE}/paymongo/payment-intent/${paymentIntentId}/attach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethodId,
          }),
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to attach payment method: ${response.status}`);
      }
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to attach payment method');
      }
      if (!data || !data.data) {
        throw new Error('Invalid response from attach payment method endpoint');
      }
      return data.data;
    } catch (error) {
      console.error('Attach Payment Method Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to attach payment method');
    }
  },

  // Get payment intent details
  getPaymentIntent: async (paymentIntentId) => {
    try {
      const response = await fetch(
        `${API_BASE}/paymongo/payment-intent/${paymentIntentId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to get payment intent: ${response.status}`);
      }
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to get payment intent');
      }
      if (!data || !data.data) {
        throw new Error('Invalid response from get payment intent endpoint');
      }
      return data.data;
    } catch (error) {
      console.error('Get Payment Intent Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get payment intent');
    }
  },

  // Create a payment link for simpler checkout
  createPaymentLink: async (amount, currency, description, remarks) => {
    try {
      const response = await fetch(`${API_BASE}/paymongo/payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          description,
          remarks,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      // Check if response indicates an error (either HTTP error or API error)
      if (!response.ok) {
        throw new Error(data?.error || `Payment Link Error: ${response.status} ${response.statusText}`);
      }

      // Check for API-level error (success: false)
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to create payment link');
      }

      // Validate response structure
      if (!data || !data.data) {
        throw new Error('Invalid response from payment link endpoint');
      }

      return data.data;
    } catch (error) {
      console.error('Create Payment Link Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create payment link');
    }
  },

  // Get payment link details
  getPaymentLink: async (linkId) => {
    try {
      const response = await fetch(`${API_BASE}/paymongo/payment-link/${linkId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to get payment link: ${response.status}`);
      }
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to get payment link');
      }
      if (!data || !data.data) {
        throw new Error('Invalid response from get payment link endpoint');
      }
      return data.data;
    } catch (error) {
      console.error('Get Payment Link Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get payment link');
    }
  },

  // Initialize PayMongo client for frontend payment handling
  initializePayMongo: () => {
    const publicKey = process.env.REACT_APP_PAYMONGO_PUBLIC_KEY || 'pk_test_ey6fZVweocUnY8aJ7wreQH9U';
    if (!publicKey) {
      console.error('PayMongo public key not found in environment variables');
      return null;
    }
    // This would load the PayMongo SDK when available
    return publicKey;
  },
};

export default paymongoApi;
