import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { supabase, SUPABASE_URL } from './supabase';

const PRODUCTION_URL = 'https://psdmjjcvaxejxktqwdcm.supabase.co';

export type SubscriptionState = 'free' | 'active' | 'trialing' | 'canceling';

export interface Entitlement {
    plan: string | null;
    status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
}

export function isSelfHosted(): boolean {
    return SUPABASE_URL !== PRODUCTION_URL;
}

export function getSubscriptionState(entitlement: Entitlement | null): SubscriptionState {
    if (!entitlement || entitlement.plan !== 'pro' || !['active', 'trialing'].includes(entitlement.status ?? '')) return 'free';
    return entitlement.cancel_at_period_end ? 'canceling' : entitlement.status as 'active' | 'trialing';
}

const selfHostedEntitlement: Entitlement = {
    plan: 'pro',
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
};

export function useEntitlement() {
    const selfHosted = isSelfHosted();
    const [entitlement, setEntitlement] = useState<Entitlement | null>(selfHosted ? selfHostedEntitlement : null);
    const [loading, setLoading] = useState(!selfHosted);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        if (selfHosted) {
            setEntitlement(selfHostedEntitlement);
            setLoading(false);
            return;
        }
        setLoading(true);
        const { data, error: queryError } = await supabase
            .from('user_entitlements')
            .select('plan, status, current_period_end, cancel_at_period_end')
            .eq('app_key', 'simpletracker')
            .maybeSingle();
        if (queryError) setError(queryError.message);
        else setEntitlement((data as Entitlement | null) ?? null);
        setLoading(false);
    };

    useEffect(() => {
        let cancelled = false;
        if (selfHosted) return () => { cancelled = true; };
        void (async () => {
            setLoading(true);
            const { data, error: queryError } = await supabase
                .from('user_entitlements')
                .select('plan, status, current_period_end, cancel_at_period_end')
                .eq('app_key', 'simpletracker')
                .maybeSingle();
            if (cancelled) return;
            if (queryError) setError(queryError.message);
            else setEntitlement((data as Entitlement | null) ?? null);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [selfHosted]);

    return { entitlement, subscriptionState: getSubscriptionState(entitlement), loading, error, refresh };
}

async function openCheckoutFunction(functionName: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke(functionName, {
        body: { appKey: 'simpletracker', plan: 'pro' },
    });
    if (error) throw new Error(error.message || 'Unable to contact the billing service.');
    if (!data?.url) throw new Error('The billing service did not return a URL.');
    await WebBrowser.openBrowserAsync(data.url);
}

export function redirectToCheckout(): Promise<void> {
    return openCheckoutFunction('create-checkout-session');
}

export function redirectToBillingPortal(): Promise<void> {
    return openCheckoutFunction('create-billing-portal-session');
}
