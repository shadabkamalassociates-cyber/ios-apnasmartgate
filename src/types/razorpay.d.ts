declare module 'react-native-razorpay' {
  export type RazorpayCheckoutSuccess = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  export type RazorpayCheckoutOptions = {
    description?: string;
    image?: string;
    currency?: string;
    key: string;
    amount: string | number;
    name?: string;
    order_id: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: { color?: string };
    notes?: Record<string, string>;
  };

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpayCheckoutSuccess>;
  };

  export default RazorpayCheckout;
}
