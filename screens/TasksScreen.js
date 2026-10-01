import {collection, addDoc} from 'firebase/firestore';
import { FlatList } from 'react-native/types_generated/index';
import React, { useState, useEffect, useContext } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AuthContext } from '../context/AuthContext';



const tasksRef = collection(db, 'tareas');
await addDoc(tasksRef, {titulo, completada: false});
setTitulo('');
Alert.alert('Tarea agregada', 'La tarea se ha agregado correctamente');


const[task,setTask] = useState([]);
onSnapshot(collection(db, 'tareas'), (snapshot) => {
  const tasks = [];
  snapshot.forEach((doc) => {
    tasks.push({id: doc.id, ...doc.data()});
  });
  setTask(tasks);
});

<FlatList
  data={task}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <View>
      <Text>{item.titulo}</Text>
      <Text>{item.completada ? 'Completada' : 'Pendiente'}</Text>
    </View>
  )}
/>

updateDoc(doc(db, 'tareas', id), {completada: true});
deleteDoc(doc(db, 'tareas', id));




export default function TasksScreen() {
  const { user, logout } = useContext(AuthContext);
  const [titulo, setTitulo] = useState('');
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    // onSnapshot deja una conexión abierta: la lista se actualiza sola
    // cada vez que se agrega, edita o borra una tarea en Firestore.
    const q = query(collection(db, 'tareas'), orderBy('creadoEn', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTasks(data);
    });

    return unsubscribe;
  }, []);

  const handleAdd = async () => {
    if (!titulo.trim()) return;
    try {
      await addDoc(collection(db, 'tareas'), {
        titulo: titulo.trim(),
        completada: false,
        creadoEn: new Date().toISOString(),
        uid: user?.uid, // para saber a quién pertenece la tarea
      });
      setTitulo('');
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar la tarea.');
    }
  };

  const toggleCompletada = async (task) => {
    await updateDoc(doc(db, 'tareas', task.id), { completada: !task.completada });
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'tareas', id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Hola, {user?.email}</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Nueva tarea..."
          value={titulo}
          onChangeText={setTitulo}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no tienes tareas. ¡Agrega la primera!</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.taskRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleCompletada(item)}>
              <Text style={[styles.taskText, item.completada && styles.taskDone]}>
                {item.completada ? '✅ ' : '⬜️ '}
                {item.titulo}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)}>
              <Text style={styles.delete}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcome: { fontSize: 15, color: '#374151', flexShrink: 1 },
  logout: { color: '#DC2626', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  taskText: { fontSize: 16, color: '#111827' },
  taskDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  delete: { fontSize: 18, paddingLeft: 12 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});