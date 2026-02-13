import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import FarmersScreen from './src/screens/FarmersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CartScreen from './src/screens/CartScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import FarmerDashboardScreen from './src/screens/FarmerDashboardScreen';
import ManageProductsScreen from './src/screens/ManageProductsScreen';
import StartSellingScreen from './src/screens/StartSellingScreen';
import FarmerProfileScreen from './src/screens/FarmerProfileScreen';
import FarmerVerifyScreen from './src/screens/FarmerVerifyScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import VerificationDashboardScreen from './src/screens/VerificationDashboardScreen';

// Context
import { AuthProvider } from './src/context/AuthContext';

// Types
import { RootStackParamList } from './src/types';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Products"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Products') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          } else if (route.name === 'Farmers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Cart') {
            iconName = focused ? 'basket' : 'basket-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#4CAF50',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Products" component={ProductsScreen} />
      <Tab.Screen name="Farmers" component={FarmersScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#4CAF50',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Create Account', headerShown: false }}
          />
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ title: 'Product Details' }}
          />
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{ title: 'My Orders' }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: 'Edit Profile' }}
          />
          <Stack.Screen
            name="FarmerDashboard"
            component={FarmerDashboardScreen}
            options={{ title: 'My Shop Dashboard' }}
          />
          <Stack.Screen
            name="ManageProducts"
            component={ManageProductsScreen}
            options={{ title: 'Manage Products' }}
          />
          <Stack.Screen
            name="StartSelling"
            component={StartSellingScreen}
            options={{ title: 'Start Selling' }}
          />
          <Stack.Screen
            name="FarmerProfile"
            component={FarmerProfileScreen}
            options={{ title: 'Farmer Profile' }}
          />
          <Stack.Screen
            name="FarmerVerify"
            component={FarmerVerifyScreen}
            options={{ title: 'Verify Your Farm' }}
          />
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{ title: 'Admin Dashboard' }}
          />
          <Stack.Screen
            name="VerificationDashboard"
            component={VerificationDashboardScreen}
            options={{ title: 'Farmer Verifications' }}
          />
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </AuthProvider>
  );
}
