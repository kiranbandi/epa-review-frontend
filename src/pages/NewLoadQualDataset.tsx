// @ts-nocheck
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonAlert,
  useIonPopover,
} from "@ionic/react";
import { csvParse, DSVRowArray } from "d3-dsv";
import { person } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import UserMenu from "../components/UserMenuNew";
import { fetchUser } from "../utils/auth";
import { FeedbackGroup, Results, Tag } from "../utils/new-data-structure";
import ServerInfo from "../utils/ServerInfo";
import { User } from "../utils/User";

let pyodide: any;
let pythonDeidentifier: any;

const Dashboard: React.FC = () => {

  // Model loading
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User>();
  const [users, setUsers] = useState<User[]>();
  const [sharedUserIds, setSharedUserIds] = useState<string[]>([]);
  const [shouldShowVideo, setShouldShowVideo] = useState(false);
  const [file, setFile] = useState<File>();
  const [data, setData] = useState<DSVRowArray<string>>();
  const [nameDictionary, setNameDictionary] = useState<any>();
  const [dataPreviewLimit, setDataPreviewLimit] = useState(10);
  const [feedbackColumns, setFeedbackColumns] = useState(["Feedback"]);
  const [residentNameColumns, setResidentNameColumns] = useState([
    "Resident Name",
  ]);
  const [observerNameColumns, setObserverNameColumns] = useState([
    "Observer Name",
  ]);
  const [processing, setProcessing] = useState(false);

  const [presentUserMenuPopover, dismissUserMenuPopover] = useIonPopover(
    UserMenu,
    { onHide: () => dismissUserMenuPopover() }
  );
  const [presentAlert] = useIonAlert();


  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      let current = new Worker(`${process.env.PUBLIC_URL}/assets/worker.js`, {
        type: 'module'
      });

      worker.current = current;
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case 'initiate':
          // Model file start load: add a new progress item to the list.
          setReady(false);
          break;

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;

        case 'complete':
          console.log(e.data.output)
          break;
      }
    };
    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);
    // Define a cleanup function for when the component is unmounted.
    return () => worker.current.removeEventListener('message', onMessageReceived);
  });

  useEffect(() => {
    worker.current.postMessage({
      text: 'Sample text sent from worker'
    });
  }, [])


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/new" />
          </IonButtons>
          <IonTitle>Generate QuAL Scores</IonTitle>
          <IonButtons slot="end">
            <IonButton
              color={user ? "primary" : ""}
              title="User"
              onClick={(event) =>
                presentUserMenuPopover({ event: event.nativeEvent })
              }
            >
              <IonIcon slot="icon-only" icon={person}></IonIcon>
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>

        {!ready &&
          <IonCard>
            <IonCardHeader>
              <IonCardTitle> Loading QuAL Score Models... Please Wait...  </IonCardTitle>
            </IonCardHeader>
          </IonCard>}

        {renderFileSelectionCard(!ready || (!!(file && data)))}
        {renderColumnSelectionCard(
          !(file && data && ready) || processing
        )}
      </IonContent>
    </IonPage>
  );

  function renderColumnSelectionCard(disabled: boolean) {
    return (
      <IonCard disabled={disabled}>
        <IonCardHeader>
          <IonCardTitle>
            Preview your data and label the feedback column below.
          </IonCardTitle>
          <IonText>
            <p>
              The qualscore generation model needs to know which column of your
              dataset contains the narrative feedback. Review the sample data that is displayed below and
              indicate the title of the column containing the narrative
              feedback.
            </p>
          </IonText>
        </IonCardHeader>
        <IonCardContent>
          <IonItem>
            <IonLabel position="stacked">Preview limit</IonLabel>
            <IonInput
              disabled={disabled}
              type="number"
              value={dataPreviewLimit}
              onIonChange={({ detail }) =>
                setDataPreviewLimit(+(detail.value || "0"))
              }
            ></IonInput>
          </IonItem>
          {data && (
            <>
              <IonText>
                <h2>Below are up to first {dataPreviewLimit} records</h2>
              </IonText>
              <div style={{ maxHeight: "30rem", overflowY: "auto" }}>
                <table style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      {data?.columns.map((columnName, i) => (
                        <th key={i}>{columnName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.slice(0, dataPreviewLimit).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((columnValue, i) => (
                          <td key={i}>{columnValue}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <IonItem>
            <IonLabel position="stacked">
              Title(s) of the column(s) containing narrative feedback (separate
              multiple titles with commas and no following space)
            </IonLabel>
            <IonInput
              disabled={disabled}
              value={feedbackColumns.join(",")}
              onIonChange={({ detail }) =>
                setFeedbackColumns(detail.value?.split(",") || [])
              }
            ></IonInput>
          </IonItem>
          <br />
          <IonButton
            disabled={disabled}
            onClick={async () => {
              presentAlert({
                header:
                  "This action may take some time (up to minutes) for large datasets, are you sure to continue?",
                buttons: [
                  {
                    text: "No",
                    role: "cancel",
                  },
                  {
                    text: "Yes",
                    role: "confirm",
                    handler: () => (saveProjectFile)(),
                  },
                ],
              });
            }}
          >
            {processing
              ? "Processing..."
              : "Generate QualScores and save the processed file"}
          </IonButton>
          <br />
        </IonCardContent>
      </IonCard>
    );
  }


  function renderFileSelectionCard(disabled: boolean) {

    return (
      <IonCard disabled={disabled}>
        <IonCardHeader>
          <IonCardTitle>Load your CSV File.</IonCardTitle>
          <IonText>
            Select the CSV file containing the dataset that you would like to
            deidentify. Please note that this file will NOT be uploaded to our
            servers, but reformatted on your local system into a new file for
            you to download.
          </IonText>
        </IonCardHeader>
        <IonCardContent>
          <IonButton disabled={disabled} onClick={() => loadCSVFile()}>
            Select file
          </IonButton>
          <br />
          <IonText>{`${file
            ? `${file.name} - ${data ? `${data.length} Records` : "Not Loaded"
            }`
            : ""
            }`}</IonText>
        </IonCardContent>
      </IonCard>
    );
  }

  async function loadCSVFile() {
    const fileHandle = (await (window as any).showOpenFilePicker())?.[0];
    const file = (await fileHandle.getFile()) as File;
    setFile(file);
    const fileContent = await file?.text();
    const data = csvParse(fileContent || "");
    if (data.length > 0) {
      setData(data);
    }
  }

  async function saveProjectFile() {
    setProcessing(true);
    setTimeout(async () => {
      const fileHandle = await (window as any).showSaveFilePicker({
        types: [
          {
            description: "EPA deidentification project file",
            accept: { "application/json": [".deid"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      const result = await processData();
      await writable.write(JSON.stringify(result));
      await writable.close();
      alert("Deidentification finished and the project file is saved.");
      setProcessing(false);
    }, 100);
  }

  async function processData() {
    const startTime = new Date();
    const records = data
      ?.filter((record) =>
        feedbackColumns?.some((columnName) => record[columnName])
      )
      ?.map((record) => ({
        feedbackTexts: feedbackColumns?.map((columnName) => record[columnName]),
        residentNames:
          residentNameColumns?.flatMap(
            (columName) => record[columName]?.match(/\w+/g) || []
          ) || [],
        observerNames:
          observerNameColumns?.flatMap(
            (columName) => record[columName]?.match(/\w+/g) || []
          ) || [],
      }));
    const results: Results = {
      feedbackGroups: (await Promise.all(
        (records || []).map(async (record, i) => {
          const names = record.residentNames.concat(record.observerNames);
          return {
            feedbacks: await Promise.all(
              record.feedbackTexts.map(async (feedback) => ({
                originalText: feedback || "",
                tags: (
                  await deidentify(feedback || "", names, nameDictionary)
                ).map(
                  (analyzerResult: { [x: string]: any }) =>
                  ({
                    ...analyzerResult,
                    name: analyzerResult["label"],
                  } as unknown as Tag)
                ),
              }))
            ),
          };
        })
      )) as FeedbackGroup[],
    };
    console.log(
      `Processing time elapsed ${new Date().getTime() - startTime.getTime()} ms.`
    );
    return {
      rawData: data,
      config: {
        feedbackColumns,
        residentNameColumns,
        observerNameColumns,
      },
      results,
    };
  }

  async function loadDeidentifier() {
    if (!pyodide) {
      pyodide = await (window as any).loadPyodide({
        indexURL: `${process.env.PUBLIC_URL}/pyodide`,
      });
    }
    const response = await fetch(`${process.env.PUBLIC_URL}/deidentifier.py`);
    const pythonScript = await response.text();
    pyodide.runPython(pythonScript);
    pythonDeidentifier = pyodide.runPython(`AnonymizeText`);
  }

  async function deidentify(
    text: string,
    names: string[],
    nicknames: { [name: string]: string[] }
  ) {
    if (!((window as any).previousNicknames === nicknames)) {
      (window as any).nicknamesAsPy = pyodide.toPy(nicknames);
      (window as any).previousNicknames = nicknames;
    }
    return pythonDeidentifier(text, names, (window as any).nicknamesAsPy).toJs({
      dict_converter: Object.fromEntries,
    });
  }
};

export default Dashboard;
