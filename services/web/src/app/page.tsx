import './globals.scss';
import React from 'react';
import styles from './styles.module.scss';
/*
import {redirect} from 'next/navigation';

export default function Home() {
  redirect('/clients');
}
*/

export default function App() {
  return <h1 className={styles.title}>Home</h1>;
}
