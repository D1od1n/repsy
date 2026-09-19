import { Stack } from 'expo-router';
import React from 'react';

export default function WorkoutLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
