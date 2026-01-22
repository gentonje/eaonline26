import React from 'react';
import { Platform, View } from 'react-native';

interface WebScrollViewProps {
    children: React.ReactNode;
    className?: string;
    contentPadding?: number;
}

export default function WebScrollView({ children, className = '', contentPadding = 16 }: WebScrollViewProps) {
    if (Platform.OS === 'web') {
        return (
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    height: '100%',
                    padding: contentPadding,
                    paddingBottom: 100,
                }}
            >
                {children}
            </div>
        );
    }

    return (
        <View className={`flex-1 p-4 pb-24 ${className}`}>
            {children}
        </View>
    );
}
