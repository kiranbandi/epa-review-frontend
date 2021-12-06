import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar, useIonPopover } from '@ionic/react';
import { apps, person } from "ionicons/icons";
import MainMenu from '../components/MainMenu';

const NicknameManagement: React.FC = () => {
  const [present, dismiss] = useIonPopover(MainMenu, { onHide: () => dismiss() });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton
              title="Main Menu"
              onClick={event => present({ event: event.nativeEvent })}
            >
              <IonIcon slot="icon-only" icon={apps}></IonIcon>
            </IonButton>
          </IonButtons>
          <IonTitle>Nickname Management</IonTitle>
          <IonButtons slot="end">
            <IonButton title="User">
              <IonIcon slot="icon-only" icon={person}></IonIcon>
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <h1>Nickname Management page works!</h1>
      </IonContent>
    </IonPage>
  );
};

export default NicknameManagement;
