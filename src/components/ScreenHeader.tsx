import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ArrowLeft, ChevronLeft, Menu } from 'lucide-react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import CartBadge from './CartBadge';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    showDrawerButton?: boolean;
    rightElement?: React.ReactNode;
    showCartBadge?: boolean;
    backIconType?: 'arrow' | 'chevron';
    onBack?: () => void;
}

export default function ScreenHeader({
    title,
    subtitle,
    showBackButton = false,
    showDrawerButton = true,
    rightElement,
    showCartBadge = true,
    backIconType = 'arrow',
    onBack
}: ScreenHeaderProps) {
    const navigation = useNavigation();

    return (
        <View className="bg-primary pt-4 pb-3 px-4 rounded-b-[20px] z-20">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                    {showBackButton ? (
                        <TouchableOpacity 
                            onPress={() => onBack ? onBack() : navigation.goBack()} 
                            className="mr-3 p-1 -ml-1"
                        >
                            {backIconType === 'arrow' ? (
                                <ArrowLeft size={20} color="black" />
                            ) : (
                                <ChevronLeft size={24} color="black" />
                            )}
                        </TouchableOpacity>
                    ) : (
                        showDrawerButton && (
                            <TouchableOpacity 
                                onPress={() => navigation.dispatch(DrawerActions.openDrawer())} 
                                className="mr-3 p-1 -ml-1"
                            >
                                <Menu size={24} color="black" />
                            </TouchableOpacity>
                        )
                    )}
                    <View className="flex-1">
                        <Text className="text-xl font-black text-black" numberOfLines={1}>{title}</Text>
                        {subtitle && (
                            <Text className="text-black/50 text-[10px] font-bold" numberOfLines={1}>{subtitle}</Text>
                        )}
                    </View>
                </View>
                <View className="ml-2 flex-row items-center">
                    {rightElement}
                    {showCartBadge && <CartBadge />}
                </View>
            </View>
        </View>
    );
}
