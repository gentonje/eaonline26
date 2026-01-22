import React from 'react';
import { Platform, View, ScrollView } from 'react-native';

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
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    padding: contentPadding,
                    paddingBottom: 100,
                }}
            >
                {children}
            </div>
        );
    }

    return (
        <ScrollView 
            className={`flex-1 ${className}`}
            contentContainerStyle={{ padding: contentPadding, paddingBottom: 100 }}
            showsVerticalScrollIndicator={true}
        >
            {children}
        </ScrollView>
    );
}
