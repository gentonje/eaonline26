import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Image,
    Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Camera, Image as ImageIcon, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";

const CATEGORIES = [
    "Electronics",
    "Fashion",
    "Home",
    "Beauty",
    "Sports",
    "Books",
    "Toys",
    "Other",
];

export default function AddProductScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ScrollView>(null);

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        price: "",
        category: "Electronics",
        available_quantity: "1",
        county: "",
        country_id: "",
        validity_period: "day",
    });
    const [images, setImages] = useState<
        Array<{ uri: string; isMain: boolean }>
    >([]);
    const [countries, setCountries] = useState<any[]>([]);

    useEffect(() => {
        fetchInitialData();

        // Flash scrollbar briefly after mount (helps on iOS)
        const timer = setTimeout(() => {
            scrollRef.current?.flashScrollIndicators();
        }, 600);

        return () => clearTimeout(timer);
    }, []);

    const fetchInitialData = async () => {
        try {
            const { data } = await supabase
                .from("countries")
                .select("*")
                .order("name");
            setCountries(data || []);
            if (data?.length) {
                setFormData((prev) => ({
                    ...prev,
                    country_id: data[0].id.toString(),
                    county: "Central",
                }));
            }
        } catch (error) {
            console.error("Error fetching countries:", error);
        }
    };

    const pickImage = async (isMain = false) => {
        if (images.length >= 5) {
            Alert.alert("Limit Reached", "Up to 5 images allowed");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.[0]) {
            const newImage = { uri: result.assets[0].uri, isMain };
            if (isMain) {
                setImages((prev) => [
                    { ...newImage, isMain: true },
                    ...prev.map((img) => ({ ...img, isMain: false })),
                ]);
            } else {
                setImages((prev) => [...prev, newImage]);
            }
            // Flash scrollbar after adding image
            setTimeout(() => scrollRef.current?.flashScrollIndicators(), 300);
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const setAsMain = (index: number) => {
        setImages((prev) => {
            const updated = prev.map((img, i) => ({
                ...img,
                isMain: i === index,
            }));
            const selected = updated.splice(index, 1)[0];
            return [selected, ...updated];
        });
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.price || images.length === 0) {
            Alert.alert(
                "Error",
                "Please fill required fields and add at least one image",
            );
            return;
        }

        try {
            setLoading(true);
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const uploadedImages = [];
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const res = await fetch(img.uri);
                const blob = await res.blob();
                const path = `${user.id}/${Date.now()}-${i}.jpg`;
                const { error: upErr } = await supabase.storage
                    .from("images")
                    .upload(path, blob, { contentType: "image/jpeg" });

                if (upErr) throw upErr;
                uploadedImages.push({ path, isMain: img.isMain });
            }

            const mainPath =
                uploadedImages.find((i) => i.isMain)?.path ||
                uploadedImages[0].path;

            const { data: product, error: prErr } = await supabase
                .from("products")
                .insert({
                    title: formData.title,
                    description: formData.description,
                    price: parseFloat(formData.price),
                    category: formData.category,
                    available_quantity: parseInt(formData.available_quantity),
                    user_id: user.id,
                    storage_path: mainPath,
                    country_id: parseInt(formData.country_id),
                    county: formData.county,
                })
                .select()
                .single();

            if (prErr) throw prErr;

            await supabase.from("product_images").insert(
                uploadedImages.map((img, i) => ({
                    product_id: product.id,
                    storage_path: img.path,
                    is_main: img.isMain,
                    display_order: i,
                })),
            );

            Alert.alert("Success", "Product listed successfully!");
            navigation.goBack();
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Failed to list product");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
            <ScreenHeader
                title="List Product"
                showBackButton={true}
                showDrawerButton={false}
            />

            <ScrollView
                ref={scrollRef}
                style={[
                    { flex: 1 },
                    Platform.OS === 'web' && { overflow: 'scroll' as any }
                ]}
                contentContainerStyle={{
                    padding: 20,
                    paddingBottom: Math.max(insets.bottom, 32) + 100,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
            >
                {/* PHOTOS */}
                <View style={{ marginBottom: 32 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 18,
                                fontWeight: "900",
                                color: "#000",
                                textTransform: "uppercase",
                                letterSpacing: 1.5,
                            }}
                        >
                            Photos ({images.length}/5)
                        </Text>
                        {images.length < 5 && (
                            <TouchableOpacity
                                onPress={() => pickImage(false)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    backgroundColor: "rgba(0,160,130,0.1)",
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                }}
                            >
                                <ImageIcon size={16} color="#00A082" />
                                <Text
                                    style={{
                                        color: "#00A082",
                                        fontWeight: "900",
                                        fontSize: 12,
                                        marginLeft: 8,
                                    }}
                                >
                                    Add More
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Main Photo */}
                    <TouchableOpacity
                        onPress={() => pickImage(true)}
                        style={{
                            width: "100%",
                            aspectRatio: 4 / 3,
                            backgroundColor: "#f8f9fa",
                            borderRadius: 30,
                            borderWidth: 2,
                            borderStyle: "dashed",
                            borderColor: "rgba(0,0,0,0.1)",
                            justifyContent: "center",
                            alignItems: "center",
                            overflow: "hidden",
                            marginBottom: 16,
                        }}
                    >
                        {images.find((img) => img.isMain) ? (
                            <View style={{ width: "100%", height: "100%" }}>
                                <Image
                                    source={{
                                        uri: images.find((img) => img.isMain)!
                                            .uri,
                                    }}
                                    style={{ width: "100%", height: "100%" }}
                                    resizeMode="cover"
                                />
                                <View
                                    style={{
                                        position: "absolute",
                                        top: 16,
                                        left: 16,
                                        backgroundColor: "#333",
                                        paddingHorizontal: 12,
                                        paddingVertical: 4,
                                        borderRadius: 999,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: "#fff",
                                            fontWeight: "900",
                                            fontSize: 10,
                                        }}
                                    >
                                        MAIN
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() =>
                                        removeImage(
                                            images.findIndex((i) => i.isMain),
                                        )
                                    }
                                    style={{
                                        position: "absolute",
                                        top: 16,
                                        right: 16,
                                        backgroundColor: "rgba(239,68,68,0.9)",
                                        padding: 8,
                                        borderRadius: 999,
                                    }}
                                >
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ alignItems: "center" }}>
                                <View
                                    style={{
                                        backgroundColor: "rgba(0,160,130,0.1)",
                                        borderRadius: 999,
                                        padding: 20,
                                        marginBottom: 12,
                                    }}
                                >
                                    <Camera size={32} color="#000" />
                                </View>
                                <Text
                                    style={{
                                        color: "#000",
                                        fontWeight: "900",
                                        fontSize: 18,
                                    }}
                                >
                                    Add Main Photo
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Other Photos */}
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 16,
                        }}
                    >
                        {images
                            .filter((img) => !img.isMain)
                            .map((img, i) => {
                                const globalIndex = images.findIndex(
                                    (x) => x === img,
                                );
                                return (
                                    <View
                                        key={globalIndex}
                                        style={{
                                            width: "47%",
                                            aspectRatio: 1,
                                            borderRadius: 24,
                                            overflow: "hidden",
                                            shadowColor: "#000",
                                            shadowOffset: {
                                                width: 0,
                                                height: 1,
                                            },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 4,
                                            elevation: 2,
                                        }}
                                    >
                                        <Image
                                            source={{ uri: img.uri }}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                            }}
                                            resizeMode="cover"
                                        />
                                        <TouchableOpacity
                                            onPress={() =>
                                                setAsMain(globalIndex)
                                            }
                                            style={{
                                                position: "absolute",
                                                top: 8,
                                                left: 8,
                                                backgroundColor:
                                                    "rgba(51,51,51,0.8)",
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 8,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: "#fff",
                                                    fontWeight: "900",
                                                    fontSize: 10,
                                                }}
                                            >
                                                Set Main
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() =>
                                                removeImage(globalIndex)
                                            }
                                            style={{
                                                position: "absolute",
                                                top: 8,
                                                right: 8,
                                                backgroundColor:
                                                    "rgba(239,68,68,0.9)",
                                                padding: 6,
                                                borderRadius: 999,
                                            }}
                                        >
                                            <X size={12} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                    </View>
                </View>

                {/* INFO */}
                <View
                    style={{
                        backgroundColor: "#f8f9fa",
                        borderRadius: 40,
                        padding: 24,
                        marginBottom: 24,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.05)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 20,
                            fontWeight: "900",
                            color: "#000",
                            marginBottom: 24,
                        }}
                    >
                        Info
                    </Text>

                    <View style={{ marginBottom: 24 }}>
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "900",
                                color: "rgba(0,0,0,0.4)",
                                textTransform: "uppercase",
                                marginBottom: 8,
                                marginLeft: 4,
                            }}
                        >
                            Title
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.1)",
                                padding: 16,
                                fontWeight: "600",
                            }}
                            placeholder="Title"
                            value={formData.title}
                            onChangeText={(t) =>
                                setFormData((p) => ({ ...p, title: t }))
                            }
                        />
                    </View>

                    <View style={{ marginBottom: 24 }}>
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "900",
                                color: "rgba(0,0,0,0.4)",
                                textTransform: "uppercase",
                                marginBottom: 8,
                                marginLeft: 4,
                            }}
                        >
                            Category
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                        >
                            {CATEGORIES.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    onPress={() =>
                                        setFormData((p) => ({
                                            ...p,
                                            category: c,
                                        }))
                                    }
                                    style={{
                                        paddingHorizontal: 20,
                                        paddingVertical: 12,
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor:
                                            formData.category === c
                                                ? "#000"
                                                : "rgba(0,0,0,0.1)",
                                        marginRight: 12,
                                        backgroundColor:
                                            formData.category === c
                                                ? "#000"
                                                : "#fff",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontWeight: "900",
                                            fontSize: 12,
                                            color:
                                                formData.category === c
                                                    ? "#fff"
                                                    : "#000",
                                        }}
                                    >
                                        {c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View>
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: "900",
                                color: "rgba(0,0,0,0.4)",
                                textTransform: "uppercase",
                                marginBottom: 8,
                                marginLeft: 4,
                            }}
                        >
                            Description
                        </Text>
                        <TextInput
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.1)",
                                padding: 16,
                                fontWeight: "600",
                                minHeight: 120,
                                textAlignVertical: "top",
                            }}
                            multiline
                            placeholder="Description"
                            value={formData.description}
                            onChangeText={(t) =>
                                setFormData((p) => ({ ...p, description: t }))
                            }
                        />
                    </View>
                </View>

                {/* PRICE & STOCK */}
                <View
                    style={{
                        backgroundColor: "#f8f9fa",
                        borderRadius: 40,
                        padding: 24,
                        marginBottom: 140,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.05)",
                    }}
                >
                    <Text
                        style={{
                            fontSize: 20,
                            fontWeight: "900",
                            color: "#000",
                            marginBottom: 24,
                        }}
                    >
                        Price & Stock
                    </Text>
                    <View style={{ flexDirection: "row", gap: 16 }}>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: "900",
                                    color: "rgba(0,0,0,0.4)",
                                    textTransform: "uppercase",
                                    marginBottom: 8,
                                    marginLeft: 4,
                                }}
                            >
                                Price
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: "#fff",
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.1)",
                                    padding: 16,
                                    fontWeight: "600",
                                }}
                                keyboardType="decimal-pad"
                                value={formData.price}
                                onChangeText={(t) =>
                                    setFormData((p) => ({ ...p, price: t }))
                                }
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: "900",
                                    color: "rgba(0,0,0,0.4)",
                                    textTransform: "uppercase",
                                    marginBottom: 8,
                                    marginLeft: 4,
                                }}
                            >
                                Qty
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: "#fff",
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: "rgba(0,0,0,0.1)",
                                    padding: 16,
                                    fontWeight: "600",
                                }}
                                keyboardType="number-pad"
                                value={formData.available_quantity}
                                onChangeText={(t) =>
                                    setFormData((p) => ({
                                        ...p,
                                        available_quantity: t,
                                    }))
                                }
                            />
                        </View>
                    </View>
                </View>

                {/* Submit Button - inside ScrollView */}
                <View
                    style={{
                        paddingTop: 24,
                        paddingBottom: Math.max(insets.bottom, 32) + 40,
                    }}
                >
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        style={{
                            backgroundColor: "#000000",
                            paddingVertical: 20,
                            borderRadius: 16,
                            alignItems: "center",
                        }}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text
                                style={{
                                    color: "#ffffff",
                                    fontWeight: "900",
                                    fontSize: 20,
                                    textTransform: "uppercase",
                                    letterSpacing: 1.5,
                                }}
                            >
                                List Product
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
