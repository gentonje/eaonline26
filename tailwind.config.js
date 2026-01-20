/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "#FFD147",
                secondary: "#FDB913",
                accent: "#00A082",
                background: "#FFFFFF",
                surface: "#F9F9F9",
            }
        },
    },
    plugins: [],
};
