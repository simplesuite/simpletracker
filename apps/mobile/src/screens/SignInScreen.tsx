import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { supabase } from '../lib/supabase';

export function SignInScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const signIn = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>
                simpleTracker
            </Text>
            <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
            />
            <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
            />
            {error ? <HelperText type="error">{error}</HelperText> : null}
            <Button
                mode="contained"
                onPress={signIn}
                loading={loading}
                disabled={loading}
                style={styles.button}
            >
                Sign in
            </Button>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
    title: { textAlign: 'center', marginBottom: 24 },
    input: { marginBottom: 4 },
    button: { marginTop: 12 },
});
