import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonPage, IonTitle, IonToolbar, useIonPopover } from '@ionic/react';
import { apps, person } from "ionicons/icons";
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router';
import MainMenu from '../components/MainMenu';
import { signOut } from '../utils/auth';
import ServerInfo from '../utils/ServerInfo';

const Review: React.FC = () => {
  const history = useHistory();
  const [groupTags, setGroupTags] = useState<string[]>();
  const [presentPopover, dismissPopover] = useIonPopover(MainMenu, { onHide: () => dismissPopover() });

  useEffect(() => {
    async function obtainGroupTags() {
      const response = await fetch(
        `${ServerInfo.SERVER_BASE_URL}/epa/group-tags`,
        { credentials: 'include' }
      );
      let groupTags: string[];
      if (response.ok && (groupTags = await response.json())) {
        setGroupTags(groupTags);
      }
    }
    obtainGroupTags();
  }, [history]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton
              title="Main Menu"
              onClick={event => presentPopover({ event: event.nativeEvent })}
            >
              <IonIcon slot="icon-only" icon={apps}></IonIcon>
            </IonButton>
          </IonButtons>
          <IonTitle>EPA Review</IonTitle>
          <IonButtons slot="end">
            <IonButton
              title="Sign Out"
              onClick={() => signOut()}
            >
              <IonIcon slot="icon-only" icon={person} ></IonIcon>
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {
          groupTags ?
            groupTags.map(groupTag => (
              <IonItem key={groupTag} button routerLink={`/review/${groupTag}`}>{groupTag}</IonItem>
            )) :
            'No Data Yet'
        }
      </IonContent>
    </IonPage>
  );
};

export default Review;
