declare module 'react-native-vector-icons/MaterialIcons' {
  import React from 'react';
  import { StyleProp, TextStyle } from 'react-native';

  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
  }

  export default class MaterialIcons extends React.Component<IconProps> {}
}
