import * as React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import SplashScreen from '../components/SplashScreen';
import {
    Home,
    ShoppingCart,
    Heart,
    User,
    Menu,
    Settings,
    Info,
    PlusCircle,
    Package,
    Shield,
    Users,
    ShieldCheck,
    MapPin,
    ShoppingBag,
    Wallet,
    CreditCard,
    Info as InfoIcon
} from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import BrowseProductsScreen from '../screens/BrowseProductsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ProductComparisonScreen from '../screens/ProductComparisonScreen';
import { CompareProvider } from '../contexts/CompareContext';
import CompareTray from '../components/CompareTray';
import MyProductsScreen from '../screens/MyProductsScreen';
import AddProductScreen from '../screens/AddProductScreen';
import EditProductScreen from '../screens/EditProductScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import UserManagementScreen from '../screens/UserManagementScreen';
import AccountManagementScreen from '../screens/AccountManagementScreen';
import ProductApprovalScreen from '../screens/ProductApprovalScreen';
import DistrictsManagementScreen from '../screens/DistrictsManagementScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import CartScreen from '../screens/CartScreen';
import WishlistScreen from '../screens/WishlistScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import WalletScreen from '../screens/WalletScreen';
import PaymentDashboardScreen from '../screens/PaymentDashboardScreen';
import BulkImportScreen from '../screens/BulkImportScreen';
import StoreScreen from '../screens/StoreScreen';
import FloatingAssistant from '../components/FloatingAssistant';
import { AssistantProvider } from '../contexts/AssistantContext';


const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// Linking config — wires React Navigation into the browser's History API
// so the device/browser Back button moves through the in-app stack instead
// of leaving the site. Each navigate() pushes a real history entry.
const linking = {
    prefixes: [
        typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'https://eastafricaonline.com',
    ],
    config: {
        screens: {
            Auth: 'login',
            App: {
                path: '',
                screens: {
                    Dashboard: 'dashboard',
                    BrowseProducts: 'browse',
                    MyProducts: 'my-products',
                    Cart: 'cart-drawer',
                    Wishlist: 'wishlist-drawer',
                    MyWallet: 'wallet-drawer',
                    PaymentDashboard: 'payments-drawer',
                    Settings: 'settings',
                    About: 'about',
                    ProductApproval: 'admin/approvals',
                    AdminPanel: 'admin/panel',
                    UserManagement: 'admin/users',
                    AccountManagement: 'admin/accounts',
                    DistrictsManagement: 'admin/districts',
                    Profile: 'profile',
                },
            },
            ProductDetail: 'product/:productId',
            ProductComparison: 'compare',
            AddProduct: 'sell',
            EditProduct: 'edit-product/:productId',
            Cart: 'cart',
            Wishlist: 'wishlist',
            Checkout: 'checkout',
            OrderSuccess: 'order-success',
            MyWallet: 'my-wallet',
            PaymentDashboard: 'my-payments',
            BulkImport: 'bulk-import',
            Store: 'store/:storeId',
        },
    },
};

function AppTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#00A082',
                tabBarInactiveTintColor: '#64748b',
                headerShown: false,
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#f1f5f9',
                    height: 60,
                    paddingBottom: 8,
                }
            }}
        >
            <Tab.Screen
                name="DashboardTab"
                component={DashboardScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
                    title: 'Dashboard'
                }}
            />
            <Tab.Screen
                name="BrowseProducts"
                component={BrowseProductsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
                    title: 'Browse'
                }}
            />
            <Tab.Screen
                name="MyProducts"
                component={MyProductsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
                    title: 'My Store'
                }}
            />
            <Tab.Screen
                name="AddProduct"
                component={AddProductScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size} />,
                    title: 'Sell'
                }}
            />
            <Tab.Screen
                name="Wishlist"
                component={WishlistScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
                    title: 'Saved'
                }}
            />
            <Tab.Screen
                name="Cart"
                component={CartScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
                    title: 'Cart'
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                    title: 'Account'
                }}
            />
        </Tab.Navigator>
    );
}

function AppDrawer() {
    const { isAdmin, isSuperAdmin } = useAuth();

    return (
            <Drawer.Navigator
                initialRouteName="BrowseProducts"
                screenOptions={{
                    headerShown: false,
                    drawerActiveTintColor: '#00A082',
                    drawerInactiveTintColor: '#64748b',
                }}
            >
            <Drawer.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                    title: 'Dashboard',
                    drawerIcon: ({ color, size }) => <Home color={color} size={size} />
                }}
            />

            <Drawer.Screen
                name="BrowseProducts"
                component={BrowseProductsScreen}
                options={{
                    title: 'Browse Products',
                    drawerIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />
                }}
            />


            <Drawer.Screen
                name="MyProducts"
                component={MyProductsScreen}
                options={{
                    title: 'My Products',
                    drawerIcon: ({ color, size }) => <Package color={color} size={size} />
                }}
            />


            <Drawer.Screen
                name="Cart"
                component={CartScreen}
                options={{
                    title: 'Cart',
                    drawerIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
                }}
            />


            <Drawer.Screen
                name="Wishlist"
                component={WishlistScreen}
                options={{
                    title: 'Wishlist',
                    drawerIcon: ({ color, size }) => <Heart color={color} size={size} />
                }}
            />


            <Drawer.Screen
                name="MyWallet"
                component={WalletScreen}
                options={{
                    title: 'My Wallet',
                    drawerIcon: ({ color, size }) => <Wallet color={color} size={size} />
                }}
            />

            <Drawer.Screen
                name="PaymentDashboard"
                component={PaymentDashboardScreen}
                options={{
                    title: 'Payments',
                    drawerIcon: ({ color, size }) => <CreditCard color={color} size={size} />
                }}
            />

            <Drawer.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    title: 'Settings',
                    drawerIcon: ({ color, size }) => <Settings color={color} size={size} />
                }}
            />

            <Drawer.Screen
                name="About"
                component={AboutScreen}
                options={{
                    title: 'About',
                    drawerIcon: ({ color, size }) => <InfoIcon color={color} size={size} />
                }}
            />

            {(isAdmin || isSuperAdmin) && (
                <>
                    <Drawer.Screen
                        name="ProductApproval"
                        component={ProductApprovalScreen}
                        options={{
                            title: 'Product Approvals',
                            drawerIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />
                        }}
                    />
                    <Drawer.Screen
                        name="AdminPanel"
                        component={AdminPanelScreen}
                        options={{
                            title: 'Admin Panel',
                            drawerIcon: ({ color, size }) => <Shield color={color} size={size} />
                        }}
                    />
                    <Drawer.Screen
                        name="UserManagement"
                        component={UserManagementScreen}
                        options={{
                            title: 'User Management',
                            drawerIcon: ({ color, size }) => <Users color={color} size={size} />
                        }}
                    />
                </>
            )}

            {isSuperAdmin && (
                <>
                    <Drawer.Screen
                        name="AccountManagement"
                        component={AccountManagementScreen}
                        options={{
                            title: 'Account Management',
                            drawerIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />
                        }}
                    />
                    <Drawer.Screen
                        name="DistrictsManagement"
                        component={DistrictsManagementScreen}
                        options={{
                            title: 'Districts Management',
                            drawerIcon: ({ color, size }) => <MapPin color={color} size={size} />
                        }}
                    />
                </>
            )}

            {/* Account Tab can be reached via Profile screen or Bottom Tab */}
            <Drawer.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'My Account',
                    drawerIcon: ({ color, size }) => <User color={color} size={size} />
                }}
            />

        </Drawer.Navigator>
    );
}

export default function RootNavigator() {
    const { session, isLoading } = useAuth();
    const [minSplashElapsed, setMinSplashElapsed] = React.useState(false);

    React.useEffect(() => {
        const t = setTimeout(() => setMinSplashElapsed(true), 4000);
        return () => clearTimeout(t);
    }, []);

    if (isLoading || !minSplashElapsed) {
        return <SplashScreen />;
    }

    return (
        <CompareProvider>
        <AssistantProvider>
        <NavigationContainer linking={linking}>
            <Stack.Navigator>
                {session ? (
                    <>
                        <Stack.Screen
                            name="App"
                            component={AppDrawer}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="ProductDetail"
                            component={ProductDetailScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="ProductComparison"
                            component={ProductComparisonScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AddProduct"
                            component={AddProductScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="EditProduct"
                            component={EditProductScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Cart"
                            component={CartScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Wishlist"
                            component={WishlistScreen}
                            options={{ headerShown: false }}
                        />

                        <Stack.Screen
                            name="Checkout"
                            component={CheckoutScreen}
                            options={{ title: 'Checkout', headerShown: false }}
                        />
                        <Stack.Screen
                            name="OrderSuccess"
                            component={OrderSuccessScreen}
                            options={{ title: 'Success', headerShown: false }}
                        />
                        <Stack.Screen
                            name="MyWallet"
                            component={WalletScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="PaymentDashboard"
                            component={PaymentDashboardScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="BulkImport"
                            component={BulkImportScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Store"
                            component={StoreScreen}
                            options={{ headerShown: false }}
                        />

                    </>
                ) : (
                    <Stack.Screen
                        name="Auth"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                )}

            </Stack.Navigator>
            {session ? <FloatingAssistant /> : null}
            {session ? <CompareTray /> : null}
        </NavigationContainer>
        </AssistantProvider>
        </CompareProvider>
    );
}

