import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';

type CompareContextValue = {
    products: any[];
    addProduct: (product: any) => void;
    replaceProducts: (nextProducts: any[]) => void;
    removeProduct: (productId: string) => void;
    clearProducts: () => void;
    isCompared: (productId: string) => boolean;
};

const CompareContext = createContext<CompareContextValue | undefined>(undefined);
const MAX_COMPARE_PRODUCTS = 4;

export function CompareProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<any[]>([]);

    const addProduct = useCallback((product: any) => {
        if (!product?.id || products.some(item => item.id === product.id)) return;
        if (products.length >= MAX_COMPARE_PRODUCTS) {
            Alert.alert('Comparison limit reached', 'You can compare up to four products at a time.');
            return;
        }
        setProducts(current => current.some(item => item.id === product.id) ? current : [...current, product]);
    }, [products]);

    const replaceProducts = useCallback((nextProducts: any[]) => {
        setProducts((nextProducts || []).filter(product => product?.id).slice(0, MAX_COMPARE_PRODUCTS));
    }, []);

    const removeProduct = useCallback((productId: string) => {
        setProducts(current => current.filter(item => item.id !== productId));
    }, []);

    const clearProducts = useCallback(() => setProducts([]), []);
    const isCompared = useCallback((productId: string) => products.some(item => item.id === productId), [products]);

    const value = useMemo(() => ({
        products, addProduct, replaceProducts, removeProduct, clearProducts, isCompared,
    }), [products, addProduct, replaceProducts, removeProduct, clearProducts, isCompared]);

    return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
    const context = useContext(CompareContext);
    if (!context) throw new Error('useCompare must be used inside CompareProvider');
    return context;
}
